package eval

import (
	"cmp"
	"slices"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr/classic"
)

// capturesByRefID holds every captured number value of an evaluation, keyed by the
// RefID that produced it and then by the fingerprint of the capture's own labels.
type capturesByRefID = map[string]map[data.Fingerprint]NumberValueCapture

// attachCaptureValues attaches to each condition frame the captures whose labels match
// the labels of that frame. Labels match when they are equal, or when one set contains
// the other.
//
// Equal labels have equal fingerprints, so an exact match is a map lookup. Any other
// match has a different number of labels, so the capture is either a subset or a
// superset of the frame. Both are found by hashing only the labels the two sides share,
// so a frame costs one lookup per distinct label-name set instead of one comparison per
// capture. Rules normally use one label-name set per RefID, so the whole call costs
// frames plus captures rather than frames times captures.
func attachCaptureValues(frames data.Frames, captures capturesByRefID) {
	if len(frames) == 0 {
		return
	}
	index := newCaptureIndex(captures)

	var matched []NumberValueCapture
	for _, frame := range frames {
		// classic conditions already have metadata set and only have one value, there's no need to add anything in this case.
		if frame.Meta != nil && frame.Meta.Custom != nil {
			if _, ok := frame.Meta.Custom.([]classic.EvalMatch); ok {
				continue // do not overwrite EvalMatch from classic condition.
			}
		}

		frame.SetMeta(&data.FrameMeta{}) // overwrite metadata

		if len(frame.Fields) != 1 {
			continue
		}
		matched = index.match(frame.Fields[0].Labels, matched[:0])
		if len(matched) > 0 {
			frame.Meta.Custom = slices.Clone(matched)
		}
	}
}

// captureIndex finds the captures that match the labels of a condition frame.
type captureIndex struct {
	// refIDs is sorted, so every run attaches matches in the same order.
	refIDs  []string
	byRefID map[string]*refIDCaptures
	// keys holds the label names of the frame being matched. match reuses it.
	keys []string
	// scratch holds the matches being sorted. sortMatches reuses it.
	scratch []orderedCapture
}

func newCaptureIndex(captures capturesByRefID) *captureIndex {
	index := &captureIndex{
		refIDs:  make([]string, 0, len(captures)),
		byRefID: make(map[string]*refIDCaptures, len(captures)),
	}
	for refID, byFingerprint := range captures {
		index.refIDs = append(index.refIDs, refID)
		index.byRefID[refID] = &refIDCaptures{byFingerprint: byFingerprint}
	}
	slices.Sort(index.refIDs)
	return index
}

// match appends every capture that matches labels to dst, and returns dst.
func (i *captureIndex) match(labels data.Labels, dst []NumberValueCapture) []NumberValueCapture {
	keys := sortedLabelKeys(labels, i.keys[:0])
	i.keys = keys

	// The projection of a label set onto its own names is the fingerprint of that set.
	// Every name is present, so the projection always exists.
	fingerprint, _ := projectFingerprint(labels, keys)
	keySet := keySetFingerprint(keys)

	for _, refID := range i.refIDs {
		captures := i.byRefID[refID]

		// First look for a capture whose labels are an exact match.
		if v, ok := captures.byFingerprint[fingerprint]; ok {
			dst = append(dst, v)
			continue
		}

		// Equal labels always have the same fingerprint, and the lookup above found none.
		// No remaining capture of this RefID can have labels equal to those of the frame,
		// so only subsets and supersets are left.
		start := len(dst)
		dst = captures.appendSubsets(labels, keys, dst)
		dst = captures.appendSupersets(labels, keys, keySet, fingerprint, dst)
		if len(dst)-start > 1 {
			i.sortMatches(dst[start:])
		}
	}
	return dst
}

// sortMatches puts the matches of one RefID in the order compareCaptures defines.
func (i *captureIndex) sortMatches(matches []NumberValueCapture) {
	// data.Labels.String sorts the label names and builds a string, so render the labels
	// of every match once here instead of once per comparison.
	i.scratch = i.scratch[:0]
	for _, capture := range matches {
		i.scratch = append(i.scratch, newOrderedCapture(capture))
	}
	slices.SortFunc(i.scratch, compareCaptures)
	for j, ordered := range i.scratch {
		matches[j] = ordered.capture
	}
}

// maxCachedSupersetIndexes bounds how many superset indexes one RefID keeps. The
// condition frames of one evaluation almost always use the same label names, so one
// index per RefID is the normal case. Past the bound a frame scans the wider captures
// instead of building an index, so the cache cannot grow with the number of frames.
const maxCachedSupersetIndexes = 8

// refIDCaptures holds the captures of one RefID.
type refIDCaptures struct {
	// byFingerprint holds every capture, keyed by the fingerprint of its own labels.
	byFingerprint map[data.Fingerprint]NumberValueCapture

	// groups holds the captures grouped by the label names they use, sorted by how many
	// names each group uses. keySetGroups builds it on first use, because a frame that
	// finds an exact match never reads it.
	groups  []captureGroup
	grouped bool

	// supersetIndexes holds the indexes supersetIndex built, keyed by the fingerprint of
	// the label names of the frame each index was built for.
	supersetIndexes map[data.Fingerprint][]cachedSupersetIndex
	cached          int
}

// captureGroup holds the captures of one RefID that use the same set of label names.
type captureGroup struct {
	// keys are the label names shared by every member, sorted in ascending order.
	keys    []string
	members []NumberValueCapture
	// byFingerprint holds the members keyed by the fingerprint of their own labels. The
	// index method builds it on first use.
	byFingerprint map[data.Fingerprint]NumberValueCapture
}

// cachedSupersetIndex holds one index and the label names of the frame it was built for.
type cachedSupersetIndex struct {
	keys     []string
	captures map[data.Fingerprint][]NumberValueCapture
}

// appendSubsets appends the captures whose labels are a strict subset of labels.
//
// A capture is a subset when the frame holds every label name the capture uses, with the
// same values. Projecting the frame labels onto the label names of a group tests both at
// once: the projection does not exist when a name is missing, and it equals the
// fingerprint of the capture's own labels when the values agree.
func (r *refIDCaptures) appendSubsets(labels data.Labels, keys []string, dst []NumberValueCapture) []NumberValueCapture {
	// A group with as many label names as the frame is skipped: such a capture can only
	// match when its labels are equal, which the exact lookup already ruled out.
	narrower := r.narrowerGroups(len(keys))
	for i := range narrower {
		group := &narrower[i]
		fingerprint, ok := projectFingerprint(labels, group.keys)
		if !ok {
			continue // the frame does not hold one of the label names of this group
		}
		v, ok := group.index()[fingerprint]
		if !ok {
			continue
		}
		// Fingerprints are 64 bit, so two different label sets can share one. Attaching a
		// candidate that is not a real subset would put the value of an unrelated series
		// into the evaluation string, so confirm it.
		if !labels.Contains(v.Labels) {
			continue
		}
		dst = append(dst, v)
	}
	return dst
}

// appendSupersets appends the captures whose labels are a strict superset of labels.
// keys holds the label names of labels, keySet the fingerprint of those names, and
// fingerprint the fingerprint of labels itself.
func (r *refIDCaptures) appendSupersets(labels data.Labels, keys []string, keySet, fingerprint data.Fingerprint, dst []NumberValueCapture) []NumberValueCapture {
	wider := r.widerGroups(len(keys))
	if len(wider) == 0 {
		return dst
	}

	index, ok := r.supersetIndex(wider, keys, keySet)
	if !ok {
		// The RefID already holds as many cached indexes as it may. Compare the labels of
		// the wider captures instead of building an index only this frame would read. Both
		// walk the wider captures once, and the comparison allocates nothing. match sorts
		// the matches afterwards, so the order they are found in does not matter.
		for i := range wider {
			for _, v := range wider[i].members {
				if v.Labels.Contains(labels) {
					dst = append(dst, v)
				}
			}
		}
		return dst
	}

	for _, v := range index[fingerprint] {
		// As in appendSubsets, confirm the candidate to rule out a shared fingerprint.
		if !v.Labels.Contains(labels) {
			continue
		}
		dst = append(dst, v)
	}
	return dst
}

// supersetIndex indexes the captures of wider, the groups that use more label names than
// the frame. keys holds the label names of the frame. The index keys each capture by the
// fingerprint of its labels projected onto those names, so a capture holds the labels of
// the frame when that projection equals the fingerprint of the frame labels.
//
// One index is cached per set of frame label names. supersetIndex reports false once the
// cache is full, because an index the cache cannot keep would serve a single frame.
func (r *refIDCaptures) supersetIndex(wider []captureGroup, keys []string, keySet data.Fingerprint) (map[data.Fingerprint][]NumberValueCapture, bool) {
	for _, cached := range r.supersetIndexes[keySet] {
		// Two sets of label names can share a fingerprint, so compare the names.
		if slices.Equal(cached.keys, keys) {
			return cached.captures, true
		}
	}
	if r.cached >= maxCachedSupersetIndexes {
		return nil, false
	}

	index := make(map[data.Fingerprint][]NumberValueCapture)
	for i := range wider {
		for _, capture := range wider[i].members {
			fingerprint, ok := projectFingerprint(capture.Labels, keys)
			if !ok {
				continue // the capture does not hold one of the label names of the frame
			}
			index[fingerprint] = append(index[fingerprint], capture)
		}
	}

	if r.supersetIndexes == nil {
		r.supersetIndexes = make(map[data.Fingerprint][]cachedSupersetIndex, 1)
	}
	r.supersetIndexes[keySet] = append(r.supersetIndexes[keySet], cachedSupersetIndex{
		keys:     slices.Clone(keys),
		captures: index,
	})
	r.cached++
	return index, true
}

// narrowerGroups returns the groups whose captures use fewer than n label names, and
// widerGroups those that use more than n. Groups are sorted by how many names they use,
// so a frame finds both ends with a binary search instead of walking every group.
func (r *refIDCaptures) narrowerGroups(n int) []captureGroup {
	groups := r.keySetGroups()
	return groups[:sort.Search(len(groups), func(i int) bool { return len(groups[i].keys) >= n })]
}

func (r *refIDCaptures) widerGroups(n int) []captureGroup {
	groups := r.keySetGroups()
	return groups[sort.Search(len(groups), func(i int) bool { return len(groups[i].keys) > n }):]
}

// keySetGroups groups the captures of the RefID by the set of label names they use, and
// sorts the groups by how many names that is.
func (r *refIDCaptures) keySetGroups() []captureGroup {
	if r.grouped {
		return r.groups
	}
	r.grouped = true

	var (
		buf      []string
		byKeySet = make(map[data.Fingerprint][]int, 1)
	)
	for _, capture := range r.byFingerprint {
		buf = sortedLabelKeys(capture.Labels, buf[:0])
		keySet := keySetFingerprint(buf)

		group := -1
		for _, i := range byKeySet[keySet] {
			// Two sets of label names can share a fingerprint, so compare the names.
			if slices.Equal(r.groups[i].keys, buf) {
				group = i
				break
			}
		}
		if group < 0 {
			group = len(r.groups)
			r.groups = append(r.groups, captureGroup{keys: slices.Clone(buf)})
			byKeySet[keySet] = append(byKeySet[keySet], group)
		}
		r.groups[group].members = append(r.groups[group].members, capture)
	}

	slices.SortFunc(r.groups, func(a, b captureGroup) int {
		if c := cmp.Compare(len(a.keys), len(b.keys)); c != 0 {
			return c
		}
		return slices.Compare(a.keys, b.keys)
	})

	if len(r.groups) == 1 {
		// Every capture uses the same label names, so the RefID is one group, and that
		// group can reuse the map the captures already live in.
		r.groups[0].byFingerprint = r.byFingerprint
	}
	return r.groups
}

// index returns the members of the group keyed by the fingerprint of their own labels.
func (g *captureGroup) index() map[data.Fingerprint]NumberValueCapture {
	if g.byFingerprint == nil {
		g.byFingerprint = make(map[data.Fingerprint]NumberValueCapture, len(g.members))
		for _, capture := range g.members {
			g.byFingerprint[capture.Labels.Fingerprint()] = capture
		}
	}
	return g.byFingerprint
}

// orderedCapture is a capture with its labels already rendered, so that sorting a list of
// captures renders the labels of each of them once.
type orderedCapture struct {
	labels  string
	capture NumberValueCapture
}

func newOrderedCapture(capture NumberValueCapture) orderedCapture {
	return orderedCapture{labels: capture.Labels.String(), capture: capture}
}

// compareCaptures puts captures in a fixed order, so an evaluation attaches them in the
// same order however the runtime walks the maps that hold them.
//
// Var comes first because extractEvalString sorts the attached captures by Var alone.
// That sort is stable, so captures that share a Var keep the order this comparison gave
// them. The string extractEvalString builds then stays the same between evaluations of
// unchanged data, and so does the capture extractValues picks among those sharing a Var.
func compareCaptures(a, b orderedCapture) int {
	if c := strings.Compare(a.capture.Var, b.capture.Var); c != 0 {
		return c
	}
	if c := strings.Compare(a.labels, b.labels); c != 0 {
		return c
	}
	if c := strings.Compare(a.capture.Type, b.capture.Type); c != 0 {
		return c
	}
	if a.capture.IsDatasourceNode != b.capture.IsDatasourceNode {
		if a.capture.IsDatasourceNode {
			return 1
		}
		return -1
	}
	switch {
	case a.capture.Value == nil && b.capture.Value == nil:
		return 0
	case a.capture.Value == nil:
		return -1
	case b.capture.Value == nil:
		return 1
	}
	return cmp.Compare(*a.capture.Value, *b.capture.Value)
}

// The constants below are the 64-bit FNV-1 parameters of hash/fnv, and the separator
// that data.Labels.Fingerprint writes after every label name and value. They are
// repeated here so that projectFingerprint can hash a label set without allocating a
// hasher or a byte slice. TestProjectFingerprint fails if the SDK changes any of them.
const (
	fnv1Offset64    uint64 = 14695981039346656037
	fnv1Prime64     uint64 = 1099511628211
	labelsSeparator uint64 = 255 // an invalid utf-8 sequence, as used by the SDK
)

// projectFingerprint returns the fingerprint of labels restricted to keys. keys must be
// sorted in ascending order and must not repeat. The result equals the fingerprint the
// SDK calculates for a data.Labels holding only those keys, so a projection and a full
// fingerprint of the same pairs compare equal.
//
// projectFingerprint reports false when labels does not hold one of the keys. A missing
// key means the projection does not exist. Hashing the remaining keys instead would
// match label sets that do not carry that key at all.
//
// Hashing here beats copying the projected pairs into a data.Labels and calling
// Fingerprint on it: that measured about three times slower and allocates a map per
// projection.
func projectFingerprint(labels data.Labels, keys []string) (data.Fingerprint, bool) {
	h := fnv1Offset64
	for _, name := range keys {
		value, ok := labels[name]
		if !ok {
			return 0, false
		}
		h = hashLabelPart(h, name)
		h = hashLabelPart(h, value)
	}
	return data.Fingerprint(h), true
}

// keySetFingerprint returns a fingerprint of the label names in keys, which must be
// sorted in ascending order. Unlike projectFingerprint it ignores label values, so it
// identifies the shape of a label set rather than its contents.
func keySetFingerprint(keys []string) data.Fingerprint {
	h := fnv1Offset64
	for _, name := range keys {
		h = hashLabelPart(h, name)
	}
	return data.Fingerprint(h)
}

// hashLabelPart adds a label name or value, followed by the separator, to an FNV-1 hash.
func hashLabelPart(h uint64, s string) uint64 {
	for i := range len(s) {
		h *= fnv1Prime64
		h ^= uint64(s[i])
	}
	h *= fnv1Prime64
	h ^= labelsSeparator
	return h
}

// sortedLabelKeys appends the names of labels to buf and sorts them in ascending order.
func sortedLabelKeys(labels data.Labels, buf []string) []string {
	for name := range labels {
		buf = append(buf, name)
	}
	slices.Sort(buf)
	return buf
}
