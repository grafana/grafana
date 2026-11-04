package converge

// Option configures planning. Every default satisfies the contract in the
// package documentation; an option that weakens it says so in its own doc
// comment.
type Option func(*config)

type config struct {
	hints      HintSet
	hintsSet   bool
	containers ContainerConfig
	budget     Budget
	moves      bool
	scope      ExclusionScope
}

func defaults() config {
	return config{moves: true, scope: ScopeConvergent}
}

// WithHints narrows planning to a set of keys. A hint says where to look,
// never what to conclude: the planner re-derives every decision from the
// declarations and observations inside the closure, and a hint that claims an
// entity was renamed carries no authority over whether it was.
//
// Absent, planning runs in [ModeFull].
func WithHints(h HintSet) Option {
	return func(c *config) { c.hints, c.hintsSet = h, true }
}

// WithContainers enables container materialisation. Absent, containers are
// never implied from entity keys and only explicitly declared containers are
// planned.
func WithContainers(cc ContainerConfig) Option {
	return func(c *config) { c.containers = cc }
}

// WithBudget caps how many entities the target may hold. When the cap binds,
// the admitted subset is chosen by a total order over keys — never by arrival
// order, scheduling or concurrency — so that two runs over identical inputs
// admit identical entities.
func WithBudget(b Budget) Option {
	return func(c *config) { c.budget = b }
}

// WithMoveDetection enables identity-preserving re-keying. Default: enabled.
//
// Disabling it changes which identities survive a relocation, never the
// content the target ends up holding.
func WithMoveDetection(enabled bool) Option {
	return func(c *config) { c.moves = enabled }
}

// WithExclusionScope selects what the plan claims about the source. Default:
// [ScopeConvergent].
func WithExclusionScope(s ExclusionScope) Option {
	return func(c *config) { c.scope = s }
}

// Budget caps what the target may hold.
type Budget struct {
	// MaxEntities caps the number of entities. Zero means unlimited.
	//
	// A budget is a target-side constraint, so admitting under one is the only
	// place where the desired state is not a function of source content alone.
	// It is contained rather than closed: admission is deterministic, and
	// everything it excludes is reported.
	MaxEntities int
}

func (b Budget) unlimited() bool { return b.MaxEntities <= 0 }
