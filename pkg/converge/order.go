package converge

import (
	"fmt"
	"sort"
)

// order builds the dependency graph over operations, assigns each one a stage,
// and writes the result into the plan.
//
// The edges are the safety invariants, stated once here rather than re-derived
// at every call site:
//
//   - a container exists before anything is placed in it;
//   - a container is emptied before it is removed;
//   - deeper containers are removed before shallower ones;
//   - anything landing inside a container happens before that container is
//     removed, because a write populates rather than vacates and is otherwise
//     stranded;
//   - capacity is freed before a binding budget consumes it.
//
// A cycle is impossible given those edges. If one is found it is a bug in this
// package, not bad input, so it panics rather than emitting an unsafe plan.
func order(p *Plan, ops []Op, budgetBinds bool) error {
	n := len(ops)
	if n == 0 {
		p.Ops, p.Stages = nil, nil
		return nil
	}

	refs := make([]OpRef, n)
	for i, o := range ops {
		refs[i] = o.Ref()
	}

	idx := indexOps(ops)
	deps := dependencies(ops, idx)
	level := levels(ops, deps, refs)
	if addCapacityEdges(ops, deps, level, budgetBinds) {
		level = levels(ops, deps, refs)
	}
	assembleStages(p, ops, deps, refs, level)
	return nil
}

// opIndex is the lookup built once per ordering run so that every edge below
// is found in constant time.
type opIndex struct {
	// ensures maps a container key to the operation bringing it into
	// existence, so operations landing in one can wait for it.
	ensures map[Key]int

	// removals and removalsByParent hold container removals. Indexing by
	// parent is what keeps ordering linear in the number of containers: a
	// removal waits for its *direct* child removals and the chain carries the
	// rest. Scanning for every descendant instead is quadratic, which is the
	// one shape that does not survive a hundred thousand entities.
	removals         map[Key][]int
	removalsByParent map[Key][]int

	// empties maps a removed container to the operations that vacate keys
	// inside it, attached at the nearest enclosing container this plan
	// actually removes.
	empties map[Key][]int

	// populates maps a removed container to the operations that put something
	// inside it.
	populates map[Key][]int

	groups map[GroupID][]int
}

func indexOps(ops []Op) *opIndex {
	idx := &opIndex{
		ensures:          make(map[Key]int, len(ops)),
		removals:         make(map[Key][]int),
		removalsByParent: make(map[Key][]int),
		empties:          make(map[Key][]int),
		populates:        make(map[Key][]int),
		groups:           make(map[GroupID][]int),
	}

	vacating := make([]int, 0, len(ops))
	for i, o := range ops {
		switch o.Kind {
		case OpEnsureContainer:
			idx.ensures[o.Key] = i
		case OpMove:
			if o.Key.IsContainer() {
				idx.ensures[o.Key] = i
			}
			vacating = append(vacating, i)
		case OpRemoveContainer:
			idx.removals[o.Key] = append(idx.removals[o.Key], i)
			parent := o.Key.Parent()
			idx.removalsByParent[parent] = append(idx.removalsByParent[parent], i)
		case OpDelete:
			vacating = append(vacating, i)
		case OpCreate, OpUpdate:
			// Neither vacates nor brings a container into existence.
		}
		if o.Group != "" {
			idx.groups[o.Group] = append(idx.groups[o.Group], i)
		}
	}

	// Each vacating operation attaches to the nearest enclosing container this
	// plan removes. Attaching to every ancestor would be correct but would put
	// one edge per ancestor on the root, and the chain of removals already
	// orders the rest.
	for _, i := range vacating {
		from := ops[i].Key
		if ops[i].Kind == OpMove {
			from = ops[i].From
		}
		for c := from.Parent(); c != ""; c = c.Parent() {
			if _, removed := idx.removals[c]; removed {
				idx.empties[c] = append(idx.empties[c], i)
				break
			}
		}
	}

	if len(idx.removals) > 0 {
		for i, o := range ops {
			// A container operation at the removed key is the other half of a
			// re-identification, ordered by its group rather than by this
			// rule. Everything else landing inside — entities and nested
			// containers alike — has to happen first.
			if o.Key == o.Container {
				continue
			}
			if _, removed := idx.removals[o.Container]; removed {
				idx.populates[o.Container] = append(idx.populates[o.Container], i)
			}
		}
	}

	return idx
}

func dependencies(ops []Op, idx *opIndex) [][]int {
	deps := make([][]int, len(ops))
	addDep := func(i, j int) {
		if i != j {
			deps[i] = append(deps[i], j)
		}
	}

	for i, o := range ops {
		switch o.Kind {
		case OpCreate, OpUpdate, OpMove, OpEnsureContainer:
			if j, ok := idx.ensures[o.Container]; ok {
				addDep(i, j)
			}
		case OpRemoveContainer:
			for _, j := range idx.empties[o.Key] {
				addDep(i, j)
			}
			for _, j := range idx.populates[o.Key] {
				addDep(i, j)
			}
			for _, j := range idx.removalsByParent[o.Key] {
				addDep(i, j)
			}
			// A container left behind by a re-identification waits for the
			// whole group: its children have to re-parent first.
			if o.Group != "" {
				for _, j := range idx.groups[o.Group] {
					if ops[j].Kind != OpRemoveContainer {
						addDep(i, j)
					}
				}
			}
		case OpDelete:
			// A deletion needs nothing to exist first.
		}
	}
	return deps
}

// levels assigns each operation the length of the longest dependency path
// reaching it. The graph's longest path is the container nesting depth plus a
// small constant, so recursion depth is bounded by the key scheme rather than
// by the number of operations.
func levels(ops []Op, deps [][]int, refs []OpRef) []int {
	const (
		unvisited = 0
		active    = 1
		done      = 2
	)
	level := make([]int, len(ops))
	mark := make([]int, len(ops))

	var visit func(int) int
	visit = func(i int) int {
		switch mark[i] {
		case done:
			return level[i]
		case active:
			panic(fmt.Sprintf("converge: dependency cycle at %s", refs[i]))
		}
		mark[i] = active
		deepest := -1
		for _, j := range deps[i] {
			if l := visit(j); l > deepest {
				deepest = l
			}
		}
		level[i] = deepest + 1
		mark[i] = done
		return level[i]
	}
	for i := range ops {
		visit(i)
	}
	return level
}

// addCapacityEdges makes creation wait for deletion when a budget binds, and
// reports whether it changed the graph.
//
// A create needs *capacity*, which any deletion provides, so the faithful
// encoding is an edge from every create to every deletion — and that is
// quadratic: a budget over ten thousand entities cost 566 MB of edges, which at
// a hundred thousand is tens of gigabytes. Instead each create waits on one
// representative, the deletion that finishes last, which gives the same
// ordering for O(creates) edges.
//
// What that buys over a floor on the creation stage: the edges are in
// DependsOn, so [Restrict] drops creates when the deletion they wait on is
// vetoed, failure propagation skips them when it fails, and a create can never
// share a stage with an operation that depends on it. What it does not buy:
// vetoing a *different* deletion no longer holds the creates back, and vetoing
// the representative holds back all of them. Conservative in the first
// direction, over-conservative in the second; both are safe.
//
// Whether anything was rejected is the wrong trigger: a replacement under a cap
// of one — the target holding z.json, the source declaring only a.json —
// rejects nothing and still needs the delete first.
func addCapacityEdges(ops []Op, deps [][]int, level []int, binding bool) bool {
	if !binding {
		return false
	}

	representative, deepest := -1, -1
	for i, o := range ops {
		if o.Kind == OpDelete && level[i] > deepest {
			representative, deepest = i, level[i]
		}
	}
	if representative < 0 {
		return false
	}

	changed := false
	for i, o := range ops {
		if o.Kind == OpCreate && i != representative {
			deps[i] = append(deps[i], representative)
			changed = true
		}
	}
	return changed
}

func assembleStages(p *Plan, ops []Op, deps [][]int, refs []OpRef, level []int) {
	maxLevel := 0
	for _, l := range level {
		if l > maxLevel {
			maxLevel = l
		}
	}

	// Key depth is the first sort term within a stage; computing it once here
	// keeps the comparator from re-counting separators on every comparison.
	depth := make([]int, len(ops))
	for i, o := range ops {
		depth[i] = o.Key.Depth()
	}

	counts := make([]int, maxLevel+1)
	for i := range ops {
		counts[level[i]]++
	}
	buckets := make([][]int, maxLevel+1)
	for l, c := range counts {
		if c > 0 {
			buckets[l] = make([]int, 0, c)
		}
	}
	for i := range ops {
		buckets[level[i]] = append(buckets[level[i]], i)
	}

	// Stages are windows into Ops rather than copies of it. Operations are
	// emitted in stage order, so each stage is a contiguous range — and at a
	// hundred thousand operations, holding every one of them twice is the
	// single largest thing a plan would allocate.
	p.Ops = make([]Op, 0, len(ops))
	p.Stages = make([][]Op, 0, len(buckets))
	bounds := make([][2]int, 0, len(buckets))

	for _, bucket := range buckets {
		if len(bucket) == 0 {
			continue
		}
		sortBucket(bucket, ops, depth)
		start := len(p.Ops)
		for _, i := range bucket {
			o := ops[i]
			if len(deps[i]) > 0 {
				o.DependsOn = dedupeRefs(deps[i], refs)
			}
			p.Ops = append(p.Ops, o)
		}
		bounds = append(bounds, [2]int{start, len(p.Ops)})
	}
	for _, b := range bounds {
		p.Stages = append(p.Stages, p.Ops[b[0]:b[1]:b[1]])
	}
}

// dedupeRefs resolves dependency indices to references, without duplicates and
// in a stable order. Small sets are deduplicated by scanning, which avoids a
// map allocation for what is almost always one or two entries.
func dedupeRefs(idxs []int, refs []OpRef) []OpRef {
	out := make([]OpRef, 0, len(idxs))
	if len(idxs) <= 8 {
		for _, j := range idxs {
			dup := false
			for _, have := range out {
				if have == refs[j] {
					dup = true
					break
				}
			}
			if !dup {
				out = append(out, refs[j])
			}
		}
	} else {
		seen := make(map[OpRef]bool, len(idxs))
		for _, j := range idxs {
			if !seen[refs[j]] {
				seen[refs[j]] = true
				out = append(out, refs[j])
			}
		}
	}
	sort.Slice(out, func(a, b int) bool { return out[a] < out[b] })
	return out
}

// sortBucket puts a stage into its stable order: shallowest key first, then
// key, then kind, then identity. Nothing depends on it for safety; it exists so
// that two runs over identical inputs produce an identical plan.
func sortBucket(bucket []int, ops []Op, depth []int) {
	sort.Slice(bucket, func(x, y int) bool {
		i, j := bucket[x], bucket[y]
		if depth[i] != depth[j] {
			return depth[i] < depth[j]
		}
		return lessOp(ops[i], ops[j])
	})
}

func lessOp(a, b Op) bool {
	if a.Key != b.Key {
		return a.Key < b.Key
	}
	if a.Kind != b.Kind {
		return a.Kind < b.Kind
	}
	if a.Identity != b.Identity {
		return a.Identity < b.Identity
	}
	return a.From < b.From
}
