package converge

import "sort"

// NewPlan computes the operations that make the target hold exactly the
// entities the source declares.
//
// It is a pure function: no I/O, no clock, no randomness, no logging, no
// goroutines. Equal inputs produce an identical plan, and the order of the
// input slices does not affect the result.
//
// Note what the signature does not contain: a previous version, a previous
// inventory, or a change list carrying authority. History cannot reach the
// decision because there is no parameter through which it could arrive.
//
// An error means a transient condition or malformed input, never a partial
// plan. A caller that receives one must not advance its version position.
func NewPlan(desired []Declaration, inventory []Observation, opts ...Option) (*Plan, error) {
	cfg := defaults()
	for _, o := range opts {
		o(&cfg)
	}

	mode := ModeFull
	var window map[Key]bool
	if cfg.hintsSet && cfg.hints.Complete {
		if len(cfg.hints.Keys) == 0 {
			// An empty complete hint set would produce an empty plan that
			// looks indistinguishable from convergence. Refuse it: a caller
			// with nothing to re-examine should not be planning.
			return nil, ErrIncompleteInput
		}
		mode = ModeHinted
		// Normalised copies: newState normalises container keys, so computing
		// the closure over the raw inputs makes "b" and "b/" behave
		// differently — the identity link is missed and the normalised
		// observation is then filtered out, so a hinted plan ensures a
		// container where a full plan moves one.
		window = cfg.hints.closure(normalisedDecls(desired), normalisedObs(inventory), cfg.containers)
	}

	// Budget admission is a question about the whole target, so a window makes
	// it unanswerable: a hinted run would admit a create without counting the
	// entities it was not pointed at. Rather than admit wrongly, plan in full
	// whenever a budget binds.
	if window != nil && !cfg.budget.unlimited() {
		mode, window = ModeFull, nil
	}

	s, err := newState(desired, inventory, window, cfg)
	if err != nil {
		return nil, err
	}

	// Order matters and is part of the contract. Entities whose container the
	// source refuses are excluded before the budget is applied, so an
	// unreachable entity never consumes capacity a reachable one needed. The
	// container set is derived from what was admitted, and re-identification is
	// known before any entity operation is emitted, so an unchanged child can
	// be rewritten to follow its container.
	s.excludeUnreachableEntities()
	s.admitBudget()
	if err := s.computeWantedContainers(); err != nil {
		return nil, err
	}
	s.preferWantedContainerObservations()
	s.demoteDuplicateContainerIdentities()
	if err := s.markReidentifications(); err != nil {
		return nil, err
	}
	s.planEntities()
	s.planContainerOps()
	if cfg.moves {
		// A targeted plan may only pair keys the caller named. Pairing it with
		// a row nobody mentioned turns "create a copy here" into "move that
		// other resource", and the restriction below would keep the move
		// because its destination was named.
		s.detectMoves(targetedKeys(cfg))
	}
	if cfg.scope == ScopeTargeted {
		s.restrictToTargeted(cfg.hints.Keys)
	}
	sortExclusions(s.exclusions)
	sortExclusions(s.rejected)

	p := &Plan{
		Exclusions: s.exclusions,
		Rejected:   s.rejected,
		Mode:       mode,
		Scope:      cfg.scope,
	}
	if err := order(p, s.ops, !cfg.budget.unlimited()); err != nil {
		return nil, err
	}
	return p, nil
}

// state holds the intermediate form of one planning run.
type state struct {
	cfg config

	entities   map[Key]Declaration
	admitted   map[Key]Declaration
	obsEntity  map[Key][]Observation
	obsCont    map[Key][]Observation
	contDecl   map[Key]Declaration
	wantCont   map[Key]containerWant
	exclusions []Exclusion
	rejected   []Exclusion

	// reidentified maps a container key to the group its re-identification
	// operations share, so that children emitted for re-parenting join it.
	reidentified map[Key]GroupID

	reportedExclusions map[Key]bool

	ops []Op
}

func newState(desired []Declaration, inventory []Observation, window map[Key]bool, cfg config) (*state, error) {
	s := &state{
		cfg: cfg,
		// One operation per declaration is the common case; a target holding
		// things the source dropped adds the rest. Guessing high here costs
		// one allocation and saves the regrowth of a slice that ends up
		// holding six figures of operations.
		ops:          make([]Op, 0, len(desired)+len(inventory)/2),
		entities:     map[Key]Declaration{},
		obsEntity:    map[Key][]Observation{},
		obsCont:      map[Key][]Observation{},
		contDecl:     map[Key]Declaration{},
		wantCont:     map[Key]containerWant{},
		reidentified: map[Key]GroupID{},
		// A container may be declared twice — by its directory entry and by its
		// metadata file — and an exclusion is reported both window-independently
		// and when its contents are pulled out, so each key reports once.
		reportedExclusions: map[Key]bool{},
	}

	inWindow := func(k Key) bool { return window == nil || window[k] }

	seen := make(map[Key]bool, len(desired))
	// Sorting first makes every downstream map iteration reproducible without
	// re-sorting at each use.
	decls := append([]Declaration(nil), desired...)
	normaliseDecls(decls)
	sort.Slice(decls, func(i, j int) bool { return decls[i].Key < decls[j].Key })

	for _, d := range decls {
		if d.Verdict == Excluded && d.Reason == "" {
			return nil, keyErr(d.Key, ErrInvalidDeclaration)
		}
		if d.Verdict != Excluded && d.Reason != "" {
			return nil, keyErr(d.Key, ErrInvalidDeclaration)
		}
		if seen[d.Key] && !d.Container {
			// One address, one thing. A source cannot declare two entities at
			// the same key.
			return nil, keyErr(d.Key, ErrInvalidDeclaration)
		}
		seen[d.Key] = true

		// An exclusion is reported whatever the operation window is. Narrowing
		// the work must not narrow the warnings: a convergent plan claims to
		// have surveyed the source, so an excluded key elsewhere in it goes on
		// being named on every run. Only a targeted plan, which never made
		// that claim, reports just what it touched.
		if d.Verdict == Excluded && cfg.scope == ScopeConvergent {
			key := d.Key
			if d.Container {
				key = key.AsContainer()
			}
			if !s.reportedExclusions[key] {
				s.reportedExclusions[key] = true
				// Removed is filled in once the observations are indexed.
				s.exclusions = append(s.exclusions, Exclusion{Key: key, Reason: d.Reason})
			}
		}

		if !inWindow(d.Key) {
			continue
		}
		switch {
		case d.Verdict == Ignored:
			// Never an entity: invisible, by contract.
		case d.Container && d.Verdict == Excluded && cfg.scope == ScopeConvergent:
			// Already reported above, window or not.
			s.contDecl[d.Key] = d
		case d.Container:
			// A container may legitimately be declared more than once: it is
			// implied by the keys beneath it and may also be described
			// explicitly, by a metadata file or a naming convention. Those
			// declarations merge, and the one that states something — an
			// identity, content, a refusal — wins over bare existence. Making
			// the caller collapse them first is asking it to re-implement
			// this.
			merged, mergeErr := mergeContainerDeclarations(s.contDecl[d.Key], d)
			if mergeErr != nil {
				return nil, mergeErr
			}
			s.contDecl[d.Key] = merged
		case d.Verdict == Excluded:
			if cfg.scope != ScopeConvergent {
				s.exclusions = append(s.exclusions, Exclusion{Key: d.Key, Reason: d.Reason})
			}
		default:
			s.entities[d.Key] = d
		}
	}

	obs := append([]Observation(nil), inventory...)
	normaliseObs(obs)
	sort.Slice(obs, func(i, j int) bool {
		if obs[i].Key != obs[j].Key {
			return obs[i].Key < obs[j].Key
		}
		return obs[i].Identity < obs[j].Identity
	})
	for _, o := range obs {
		if !inWindow(o.Key) {
			continue
		}
		if o.Container {
			s.obsCont[o.Key] = append(s.obsCont[o.Key], o)
		} else {
			s.obsEntity[o.Key] = append(s.obsEntity[o.Key], o)
		}
	}

	// An exclusion is destructive on this run only if the target holds
	// something at the excluded key right now — an entity or a container.
	// Checking only entities makes a held, excluded folder look harmless in a
	// preview even though the plan removes it.
	for i := range s.exclusions {
		s.exclusions[i].Removed = s.holdsAnythingAt(s.exclusions[i].Key)
	}

	return s, nil
}

func normalisedDecls(ds []Declaration) []Declaration {
	out := append([]Declaration(nil), ds...)
	normaliseDecls(out)
	return out
}

func normalisedObs(os []Observation) []Observation {
	out := append([]Observation(nil), os...)
	normaliseObs(out)
	return out
}

func normaliseDecls(ds []Declaration) {
	for i := range ds {
		if ds[i].Container {
			ds[i].Key = ds[i].Key.AsContainer()
		}
	}
}

func normaliseObs(os []Observation) {
	for i := range os {
		if os[i].Container {
			os[i].Key = os[i].Key.AsContainer()
		}
	}
}

// sortedEntityKeys returns the desired entity keys in the total order used for
// budget admission and operation emission: shallowest first, then
// lexicographic. The order is part of the contract, not an implementation
// detail — it is what makes admission under a binding budget reproducible.
func (s *state) sortedEntityKeys(m map[Key]Declaration) []Key {
	keys := make([]Key, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sortKeys(keys)
	return keys
}

// sortKeys orders keys shallowest first, then lexicographically.
//
// Depth is computed once per key rather than inside the comparator. Counting
// separators is cheap, but a comparison sort calls it O(n log n) times on both
// sides, and at a hundred thousand keys that alone was a third of planning.
func sortKeys(keys []Key) {
	if len(keys) < 2 {
		return
	}
	depths := make([]int, len(keys))
	for i, k := range keys {
		depths[i] = k.Depth()
	}
	sort.Sort(&byDepthThenKey{keys: keys, depths: depths})
}

type byDepthThenKey struct {
	keys   []Key
	depths []int
}

func (s *byDepthThenKey) Len() int { return len(s.keys) }

func (s *byDepthThenKey) Swap(i, j int) {
	s.keys[i], s.keys[j] = s.keys[j], s.keys[i]
	s.depths[i], s.depths[j] = s.depths[j], s.depths[i]
}

func (s *byDepthThenKey) Less(i, j int) bool {
	if s.depths[i] != s.depths[j] {
		return s.depths[i] < s.depths[j]
	}
	return s.keys[i] < s.keys[j]
}

// admitBudget selects the entities the target may hold. When the budget binds,
// the admitted subset is a function of the key order alone: never of arrival
// order, scheduling or concurrency, so that two runs over identical inputs
// admit identical entities.
func (s *state) admitBudget() {
	if s.cfg.budget.unlimited() {
		s.admitted = s.entities
		return
	}
	s.admitted = make(map[Key]Declaration, len(s.entities))
	for i, k := range s.sortedEntityKeys(s.entities) {
		if i < s.cfg.budget.MaxEntities {
			s.admitted[k] = s.entities[k]
			continue
		}
		s.rejected = append(s.rejected, Exclusion{
			Key:     k,
			Reason:  ReasonOverBudget,
			Removed: len(s.obsEntity[k]) > 0,
		})
	}
}

// targetedKeys returns the keys a targeted plan is allowed to act on, or nil
// when the plan is convergent and may act on anything.
func targetedKeys(cfg config) map[Key]bool {
	if cfg.scope != ScopeTargeted {
		return nil
	}
	named := make(map[Key]bool, len(cfg.hints.Keys)*2)
	for _, k := range cfg.hints.Keys {
		named[k] = true
		named[k.AsContainer()] = true
	}
	return named
}

// holdsAnythingAt reports whether the target holds an entity or a container at
// the key. Checking only entities makes a held, excluded folder look
// non-destructive in a preview even though the plan removes it.
func (s *state) holdsAnythingAt(k Key) bool {
	return len(s.obsEntity[k]) > 0 || len(s.obsCont[k.AsContainer()]) > 0
}

func sortExclusions(xs []Exclusion) {
	sort.Slice(xs, func(i, j int) bool {
		if xs[i].Key != xs[j].Key {
			return xs[i].Key < xs[j].Key
		}
		return xs[i].Reason < xs[j].Reason
	})
}
