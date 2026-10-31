package conformance

import (
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/converge"
)

// HeldContainer is one container the model holds.
type HeldContainer struct {
	Identity    converge.Identity
	Fingerprint converge.Fingerprint
}

// Entry is one entity the model holds.
type Entry struct {
	Identity    converge.Identity
	Fingerprint converge.Fingerprint

	// Parent is the container identity this entity currently sits under. A
	// key cannot stand in for it: a target may hold two containers at one key,
	// and an entity has to belong to exactly one of them.
	Parent converge.Identity
}

// Model is a reference target: a map of entities, a map of containers, and the
// ordering invariants enforced on every operation applied to it.
//
// It is the simplest thing that can tell a correct plan from an unsafe one,
// which is the point: a plan is only as trustworthy as the cheapest
// independent check that agrees with it.
type Model struct {
	Entities map[converge.Key]Entry

	// Containers maps a key to every container held there — identity and the
	// content the source stated about it. Dropping the fingerprint makes the
	// model unable to check idempotence for a metadata-bearing container:
	// re-planning against an inventory that lost it produces another content
	// change, for ever. It is a
	// list rather than one identity because both states a plan has to survive
	// put two there at once: a container taking a new identity while the old
	// one is removed, and a target that genuinely holds duplicates at a path.
	// Collapsing them to one identity makes a correct re-identification look
	// like the survivor being deleted — which is a model that cannot fail the
	// plans it most needs to check.
	Containers map[converge.Key][]HeldContainer

	// RequireContainers enforces that an entity is only written into a
	// container the model holds. Leave it false for a flat target.
	RequireContainers bool
}

// NewModel returns an empty model.
func NewModel(requireContainers bool) *Model {
	return &Model{
		Entities:          map[converge.Key]Entry{},
		Containers:        map[converge.Key][]HeldContainer{},
		RequireContainers: requireContainers,
	}
}

// Clone returns a deep copy.
func (m *Model) Clone() *Model {
	out := NewModel(m.RequireContainers)
	for k, v := range m.Entities {
		out.Entities[k] = v
	}
	for k, v := range m.Containers {
		out.Containers[k] = append([]HeldContainer(nil), v...)
	}
	return out
}

// holds reports whether the model holds a container with this identity at the
// key.
func (m *Model) holds(k converge.Key, id converge.Identity) bool {
	for _, held := range m.Containers[k] {
		if held.Identity == id {
			return true
		}
	}
	return false
}

// Inventory renders the model as observations, in a stable order.
func (m *Model) Inventory() []converge.Observation {
	out := make([]converge.Observation, 0, len(m.Entities)+len(m.Containers))
	for k, e := range m.Entities {
		out = append(out, converge.Observation{
			Key: k, Identity: e.Identity, Fingerprint: e.Fingerprint, Parent: e.Parent,
		})
	}
	for k, held := range m.Containers {
		for _, c := range held {
			out = append(out, converge.Observation{
				Key: k, Identity: c.Identity, Fingerprint: c.Fingerprint,
				Container: true, Parent: m.parentOf(k),
			})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Key != out[j].Key {
			return out[i].Key < out[j].Key
		}
		return out[i].Identity < out[j].Identity
	})
	return out
}

// parentOf reports the identity of the container holding this container, for
// the inventory. A key with more than one container above it is ambiguous, so
// nothing is claimed.
func (m *Model) parentOf(k converge.Key) converge.Identity {
	above := m.Containers[k.Parent()]
	if len(above) != 1 {
		return ""
	}
	return above[0].Identity
}

// Apply executes a plan in order, enforcing the ordering invariants. An error
// means the plan was unsafe, not that the model refused it.
func (m *Model) Apply(p *converge.Plan) error {
	for i, op := range p.Ops {
		if err := m.applyOp(op); err != nil {
			return fmt.Errorf("op %d (%s %s): %w", i, op.Kind, op.Key, err)
		}
	}
	return nil
}

// ApplyStages executes a plan stage by stage, checking additionally that no
// operation inside a stage depends on another in the same stage and that every
// operation is satisfiable before any of its stage-mates have run.
//
// Applying a stage in slice order would hide a missing dependency edge whenever
// the slice happens to be favourably ordered: an ensure followed by a write
// into it succeeds sequentially and fails under the concurrency a stage
// promises. Each operation is therefore checked against the state the stage
// started from, and only then applied.
func (m *Model) ApplyStages(p *converge.Plan) error {
	for si, stage := range p.Stages {
		within := make(map[converge.OpRef]bool, len(stage))
		for _, op := range stage {
			within[op.Ref()] = true
		}
		for _, op := range stage {
			for _, dep := range op.DependsOn {
				if within[dep] {
					return fmt.Errorf("stage %d: %s depends on %s in the same stage", si, op.Ref(), dep)
				}
			}
		}
		atStart := m.Clone()
		for _, op := range stage {
			if err := atStart.applyOp(op); err != nil {
				return fmt.Errorf("stage %d (%s %s) is not independent of its stage: %w", si, op.Kind, op.Key, err)
			}
			atStart = m.Clone()
		}
		for _, op := range stage {
			if err := m.applyOp(op); err != nil {
				return fmt.Errorf("stage %d (%s %s): %w", si, op.Kind, op.Key, err)
			}
		}
	}
	return nil
}

func (m *Model) applyOp(op converge.Op) error {
	switch op.Kind {
	case converge.OpCreate:
		if err := m.requireContainer(op.Key, op.ContainerIdentity); err != nil {
			return err
		}
		if _, exists := m.Entities[op.Key]; exists {
			return fmt.Errorf("create over an existing entity")
		}
		m.Entities[op.Key] = Entry{
			Identity:    assignIdentity(op.Key),
			Fingerprint: op.Fingerprint,
			Parent:      op.ContainerIdentity,
		}

	case converge.OpUpdate:
		cur, exists := m.Entities[op.Key]
		if !exists {
			return fmt.Errorf("update of an entity that is not held")
		}
		if err := m.requireContainer(op.Key, op.ContainerIdentity); err != nil {
			return err
		}
		if cur.Identity != op.Identity {
			return fmt.Errorf("update targets identity %q but %q is held", op.Identity, cur.Identity)
		}
		cur.Fingerprint = op.Fingerprint
		cur.Parent = op.ContainerIdentity
		m.Entities[op.Key] = cur

	case converge.OpDelete:
		cur, exists := m.Entities[op.Key]
		if !exists {
			return fmt.Errorf("delete of an entity that is not held")
		}
		if cur.Identity != op.Identity {
			return fmt.Errorf("delete targets identity %q but %q is held", op.Identity, cur.Identity)
		}
		delete(m.Entities, op.Key)

	case converge.OpMove:
		if op.Key.IsContainer() {
			if !m.holds(op.From, op.Identity) {
				return fmt.Errorf("move of a container that is not held")
			}
			if err := m.requireContainer(op.Key, op.ContainerIdentity); err != nil {
				return err
			}
			moved := HeldContainer{Identity: op.Identity, Fingerprint: op.Fingerprint}
			for _, c := range m.Containers[op.From] {
				if c.Identity == op.Identity && op.Fingerprint == "" {
					moved.Fingerprint = c.Fingerprint
				}
			}
			m.removeContainer(op.From, op.Identity)
			m.Containers[op.Key] = append(m.Containers[op.Key], moved)
			return nil
		}
		cur, exists := m.Entities[op.From]
		if !exists {
			return fmt.Errorf("move of an entity that is not held")
		}
		if cur.Identity != op.Identity {
			return fmt.Errorf("move targets identity %q but %q is held", op.Identity, cur.Identity)
		}
		if err := m.requireContainer(op.Key, op.ContainerIdentity); err != nil {
			return err
		}
		delete(m.Entities, op.From)
		cur.Fingerprint = op.Fingerprint
		cur.Parent = op.ContainerIdentity
		m.Entities[op.Key] = cur

	case converge.OpEnsureContainer, converge.OpRemoveContainer:
		return m.applyContainerOp(op)
	}
	return nil
}

func (m *Model) applyContainerOp(op converge.Op) error {
	switch op.Kind {
	case converge.OpCreate, converge.OpUpdate, converge.OpDelete, converge.OpMove:
		return fmt.Errorf("not a container operation: %s", op.Kind)
	case converge.OpEnsureContainer:
		if err := m.requireContainer(op.Key, op.ContainerIdentity); err != nil {
			return err
		}
		// Idempotent by contract: the plan may ensure a container that is
		// already there, and an ensure is also how a container's own content is
		// re-asserted — so the fingerprint is written either way.
		updated := false
		for i, c := range m.Containers[op.Key] {
			if c.Identity == op.Identity {
				m.Containers[op.Key][i].Fingerprint = op.Fingerprint
				updated = true
				break
			}
		}
		if !updated {
			m.Containers[op.Key] = append(m.Containers[op.Key],
				HeldContainer{Identity: op.Identity, Fingerprint: op.Fingerprint})
		}

	case converge.OpRemoveContainer:
		if !m.holds(op.Key, op.Identity) {
			return fmt.Errorf("remove of a container identity that is not held at %q", op.Key)
		}
		// Emptiness is a question about this identity, not about the key. A
		// re-identification leaves two containers at one key, and the one
		// being removed is empty precisely when nothing points at it any more.
		for k, e := range m.Entities {
			held := false
			if op.Identity != "" && e.Parent != "" {
				held = e.Parent == op.Identity
			} else {
				// One side carries no identity — an identity-agnostic target,
				// or an entity written before parentage was known — so the key
				// is all there is to go on.
				held = k.Within(op.Key)
			}
			if held {
				return fmt.Errorf("remove of a container that still holds %q", k)
			}
		}
		for c, held := range m.Containers {
			if c == op.Key || !c.Within(op.Key) {
				continue
			}
			if len(held) > 0 {
				return fmt.Errorf("remove of a container that still holds container %q", c)
			}
		}
		m.removeContainer(op.Key, op.Identity)
	}
	return nil
}

func (m *Model) removeContainer(k converge.Key, id converge.Identity) {
	kept := m.Containers[k][:0]
	for _, held := range m.Containers[k] {
		if held.Identity != id {
			kept = append(kept, held)
		}
	}
	if len(kept) == 0 {
		delete(m.Containers, k)
		return
	}
	m.Containers[k] = kept
}

// requireContainer enforces that a key's parent container exists before
// anything is placed in it. This is the invariant that costs the most to get
// wrong: a plan that violates it leaves entities parented to nothing.
// requireContainer checks that the container an operation parents something to
// is held. The identity matters, not just the path: a re-identification leaves
// two containers at one key, and accepting any of them lets a plan parent a
// child to an identity that does not exist yet.
//
// An identity-agnostic target states no parent, and then the key is all there
// is to go on.
func (m *Model) requireContainer(k converge.Key, parent converge.Identity) error {
	if !m.RequireContainers {
		return nil
	}
	at := k.Parent()
	if at == "" {
		return nil
	}
	if len(m.Containers[at]) == 0 {
		return fmt.Errorf("container %q does not exist", at)
	}
	if parent == "" {
		return nil
	}
	if !m.holds(at, parent) {
		return fmt.Errorf("container %q at %q is not held", parent, at)
	}
	return nil
}

// assignIdentity stands in for the target minting an identity on create. It is
// derived from the key so that a model run is reproducible.
func assignIdentity(k converge.Key) converge.Identity {
	return converge.Identity("minted:" + string(k))
}

// Content returns the model's entities as a key-to-fingerprint map, for
// comparing two runs that may have assigned different identities.
func (m *Model) Content() map[converge.Key]converge.Fingerprint {
	out := make(map[converge.Key]converge.Fingerprint, len(m.Entities))
	for k, e := range m.Entities {
		out[k] = e.Fingerprint
	}
	return out
}
