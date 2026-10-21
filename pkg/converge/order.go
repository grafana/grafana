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
//   - children re-parent before the container they left is removed;
//   - capacity is freed before a binding budget consumes it.
//
// A cycle is impossible given those edges. If one is found it is a bug in this
// package, not bad input, so it panics rather than emitting an unsafe plan.
func order(p *Plan, ops []Op) error {
	n := len(ops)
	if n == 0 {
		p.Ops, p.Stages = nil, nil
		return nil
	}

	refs := make([]OpRef, n)
	byRef := make(map[OpRef]int, n)
	for i, o := range ops {
		refs[i] = o.Ref()
		byRef[refs[i]] = i
	}

	// Containers this plan brings into existence, so operations landing in one
	// can wait for it.
	ensures := make(map[Key]int, n)
	// Container removals, by key and by parent. Indexing by parent is what
	// keeps ordering linear: a removal waits for its *direct* child removals,
	// and the chain carries the rest. Scanning for every descendant instead
	// is quadratic in the number of containers, which is the one shape that
	// does not survive a hundred thousand entities.
	removals := make(map[Key][]int)
	removalsByParent := make(map[Key][]int)
	groups := make(map[GroupID][]int)
	vacated := make([]int, 0, n)

	for i, o := range ops {
		switch o.Kind {
		case OpEnsureContainer:
			ensures[o.Key] = i
		case OpMove:
			if o.Key.IsContainer() {
				ensures[o.Key] = i
			}
		case OpRemoveContainer:
			removals[o.Key] = append(removals[o.Key], i)
			removalsByParent[o.Key.Parent()] = append(removalsByParent[o.Key.Parent()], i)
		}
		if o.Group != "" {
			groups[o.Group] = append(groups[o.Group], i)
		}
		if o.Kind == OpDelete || (o.Kind == OpMove && o.From != "") {
			vacated = append(vacated, i)
		}
	}

	// Each vacating operation is attached to the nearest enclosing container
	// that this plan actually removes. Attaching to every ancestor instead
	// would be correct but would put one edge per ancestor on the root, and
	// the chain of removals already orders the rest.
	empties := make(map[Key][]int)
	for _, i := range vacated {
		from := ops[i].Key
		if ops[i].Kind == OpMove {
			from = ops[i].From
		}
		for c := from.Parent(); c != ""; c = c.Parent() {
			if _, removed := removals[c]; removed {
				empties[c] = append(empties[c], i)
				break
			}
		}
	}

	// Anything that lands at a key inside a container this plan removes has to
	// happen first. Writing into a container that is about to be removed is
	// never the right order, whatever the reason for the removal: the write is
	// re-parenting to a surviving object at that key, or to a new identity
	// replacing an old one, and either way it is stranded if the removal wins.
	//
	// This cannot be left to the caller to declare. A write *populates* a
	// container rather than vacating it, so no vacating edge covers it, and a
	// consumer that assembled the operations itself has no reason to know the
	// rule exists.
	populates := make(map[Key][]int)
	if len(removals) > 0 {
		for i, o := range ops {
			// A container operation at the removed key is the other half of a
			// re-identification, ordered by its group rather than by this
			// rule. Everything else landing inside — entities and nested
			// containers alike — has to happen first.
			if o.Key == o.Container {
				continue
			}
			if _, removed := removals[o.Container]; removed {
				populates[o.Container] = append(populates[o.Container], i)
			}
		}
	}

	deps := make([][]int, n)
	addDep := func(i, j int) {
		if i != j {
			deps[i] = append(deps[i], j)
		}
	}

	for i, o := range ops {
		switch o.Kind {
		case OpCreate, OpUpdate, OpMove, OpEnsureContainer:
			if j, ok := ensures[o.Container]; ok {
				addDep(i, j)
			}
		case OpRemoveContainer:
			for _, j := range empties[o.Key] {
				addDep(i, j)
			}
			for _, j := range populates[o.Key] {
				addDep(i, j)
			}
			for _, j := range removalsByParent[o.Key] {
				addDep(i, j)
			}
			// A container left behind by a re-identification waits for the
			// whole group: its children have to re-parent first.
			if o.Group != "" {
				for _, j := range groups[o.Group] {
					if ops[j].Kind != OpRemoveContainer {
						addDep(i, j)
					}
				}
			}
		}
	}

	// Levels are computed by depth-first walk. The graph's longest path is the
	// container nesting depth plus a small constant, so recursion depth is
	// bounded by the key scheme rather than by the number of operations.
	level := make([]int, n)
	const (
		unvisited = 0
		active    = 1
		done      = 2
	)
	mark := make([]int, n)
	var visit func(int) int
	visit = func(i int) int {
		switch mark[i] {
		case done:
			return level[i]
		case active:
			panic(fmt.Sprintf("converge: dependency cycle at %s", refs[i]))
		}
		mark[i] = active
		max := -1
		for _, j := range deps[i] {
			if l := visit(j); l > max {
				max = l
			}
		}
		level[i] = max + 1
		mark[i] = done
		return level[i]
	}
	for i := range ops {
		visit(i)
	}

	// A binding budget makes creation depend on capacity rather than on any one
	// deletion, so it is expressed as a floor on the creation stage instead of
	// an edge from every create to every delete.
	if len(p.Rejected) > 0 {
		freeing := -1
		for i, o := range ops {
			if o.Kind == OpDelete && level[i] > freeing {
				freeing = level[i]
			}
		}
		if freeing >= 0 {
			for i, o := range ops {
				if o.Kind == OpCreate && level[i] <= freeing {
					level[i] = freeing + 1
				}
			}
		}
	}

	maxLevel := 0
	for _, l := range level {
		if l > maxLevel {
			maxLevel = l
		}
	}

	// Key depth is the first sort term within a stage; computing it once here
	// keeps the comparator from re-counting separators on every comparison.
	depth := make([]int, n)
	for i, o := range ops {
		depth[i] = o.Key.Depth()
	}

	buckets := make([][]int, maxLevel+1)
	counts := make([]int, maxLevel+1)
	for i := range ops {
		counts[level[i]]++
	}
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
	p.Ops = make([]Op, 0, n)
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
	return nil
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
