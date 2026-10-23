package conformance

import (
	"fmt"
	"math/rand"
	"sort"

	"github.com/grafana/grafana/pkg/converge"
)

type generator struct {
	rng   *rand.Rand
	opts  Options
	index int
}

func newGenerator(opts Options) *generator {
	seed := opts.Seed
	if seed == 0 {
		seed = 1
	}
	return &generator{rng: rand.New(rand.NewSource(seed)), opts: opts}
}

// next builds one scenario: a desired set, a target state, and the hint keys a
// caller would have to supply for a hinted run to be equivalent to a full one.
func (g *generator) next() scenario {
	g.index++

	keys := g.keyspace()
	desired := make([]converge.Declaration, 0, len(keys))
	model := NewModel(g.opts.Containers.Implied)

	for _, k := range keys {
		switch g.rng.Intn(10) {
		case 0:
			desired = append(desired, converge.Declaration{
				Key: k, Verdict: converge.Excluded, Reason: "generated-exclusion",
			})
		case 1:
			desired = append(desired, converge.Declaration{Key: k, Verdict: converge.Ignored})
		case 2:
			// Declared by neither side: exercises deletion.
		default:
			desired = append(desired, converge.Declaration{Key: k, Fingerprint: g.fingerprint()})
		}
	}

	// Seed the target independently of the desired set, so the diff is real
	// rather than a subset.
	for _, k := range keys {
		if g.rng.Intn(3) == 0 {
			continue
		}
		model.Entities[k] = Entry{
			Identity:    converge.Identity("held:" + string(k)),
			Fingerprint: g.fingerprint(),
		}
	}
	if g.opts.Containers.Implied {
		for k := range model.Entities {
			for _, a := range k.Ancestors() {
				if _, ok := model.Containers[a]; ok {
					continue
				}
				// No fingerprint: the generated desired set declares entities
				// only, so an implied container states nothing about itself and
				// giving the held one content would make every run a content
				// change. Metadata-bearing containers are covered explicitly in
				// TestContainerContentRoundTrips.
				model.Containers[a] = []HeldContainer{{Identity: g.containerIdentity(a)}}
			}
		}
		// A container nothing declares, so removal is exercised too.
		if g.rng.Intn(2) == 0 {
			orphan := converge.Key("orphan/")
			model.Containers[orphan] = []HeldContainer{{Identity: g.containerIdentity(orphan)}}
		}
	}

	return scenario{
		index:    g.index,
		desired:  desired,
		model:    model,
		hintKeys: hintKeysFor(desired, model),
	}
}

func (g *generator) keyspace() []converge.Key {
	roots := []string{"a", "b"}
	leaves := []string{"one.json", "two.json", "three.json"}
	var keys []converge.Key
	for _, r := range roots {
		keys = append(keys, converge.Key(r+"/"+leaves[g.rng.Intn(len(leaves))]))
		if g.rng.Intn(2) == 0 {
			keys = append(keys, converge.Key(r+"/nested/"+leaves[g.rng.Intn(len(leaves))]))
		}
	}
	keys = append(keys, converge.Key(leaves[g.rng.Intn(len(leaves))]))

	seen := map[converge.Key]bool{}
	out := keys[:0]
	for _, k := range keys {
		if !seen[k] {
			seen[k] = true
			out = append(out, k)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

func (g *generator) fingerprint() converge.Fingerprint {
	// A small alphabet makes coincidental matches — and therefore move
	// detection and its ambiguous case — common rather than rare.
	return converge.Fingerprint(fmt.Sprintf("fp%d", g.rng.Intn(4)))
}

func (g *generator) containerIdentity(k converge.Key) converge.Identity {
	if g.opts.Containers.FallbackIdentity != nil {
		return g.opts.Containers.FallbackIdentity(k)
	}
	return converge.Identity("container:" + string(k))
}

// hintKeysFor returns the complete set of keys a hinted run must be pointed at
// to be equivalent to a full one: everything that differs between the two
// sides, every container the target holds that the desired set may not imply,
// and every key sharing a fingerprint with one of those, so that both halves
// of a relocation fall inside the window.
//
// Deriving this is the caller's job, not the planner's — a hinted run cannot
// discover a key it was never told about. Writing it out here is the clearest
// statement of that obligation.
func hintKeysFor(desired []converge.Declaration, m *Model) []converge.Key {
	declared := map[converge.Key]converge.Fingerprint{}
	holdable := map[converge.Key]bool{}
	for _, d := range desired {
		if d.Container {
			continue
		}
		declared[d.Key] = d.Fingerprint
		if d.Verdict == converge.Entity {
			holdable[d.Key] = true
		}
	}

	diff := map[converge.Key]bool{}
	for k, want := range declared {
		held, exists := m.Entities[k]
		if !holdable[k] || !exists || held.Fingerprint != want {
			diff[k] = true
		}
	}
	for k, held := range m.Entities {
		if !holdable[k] || held.Fingerprint != declared[k] {
			diff[k] = true
		}
	}
	for c := range m.Containers {
		diff[c] = true
	}

	// Fingerprint closure: a relocation has two halves and both must be in.
	fps := map[converge.Fingerprint]bool{}
	for k := range diff {
		if fp, ok := declared[k]; ok && fp != "" {
			fps[fp] = true
		}
		if e, ok := m.Entities[k]; ok && e.Fingerprint != "" {
			fps[e.Fingerprint] = true
		}
	}
	for k, fp := range declared {
		if fps[fp] {
			diff[k] = true
		}
	}
	for k, e := range m.Entities {
		if fps[e.Fingerprint] {
			diff[k] = true
		}
	}

	out := make([]converge.Key, 0, len(diff))
	for k := range diff {
		out = append(out, k)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}
