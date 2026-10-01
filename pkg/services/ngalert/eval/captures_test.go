package eval

import (
	"fmt"
	"math/rand"
	"reflect"
	"slices"
	"sort"
	"strconv"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/classic"
)

func TestAttachCaptureValues(t *testing.T) {
	testCases := []struct {
		name string
		// frame is the condition frame that receives the captures.
		frame *data.Frame
		// captures are the captured values of every query and expression.
		captures capturesByRefID
		// expected is the multiset of captures attached to the frame, in the format of
		// captureKey. A nil value means that Meta.Custom must stay nil.
		expected []string
	}{
		{
			name:  "exact match suppresses subset and superset matching",
			frame: floatFrame("B", data.Labels{"cluster": "a", "pod": "p"}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a", "pod": "p"}, 1),
				capture("A", data.Labels{"cluster": "a"}, 2),
				capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "j"}, 3),
			),
			expected: []string{captureKey(capture("A", data.Labels{"cluster": "a", "pod": "p"}, 1))},
		},
		{
			name:  "capture labels are a strict subset",
			frame: floatFrame("B", data.Labels{"cluster": "a", "pod": "p"}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a"}, 1),
			),
			expected: []string{captureKey(capture("A", data.Labels{"cluster": "a"}, 1))},
		},
		{
			name:  "capture labels are a strict superset",
			frame: floatFrame("B", data.Labels{"cluster": "a"}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a", "pod": "p"}, 1),
			),
			expected: []string{captureKey(capture("A", data.Labels{"cluster": "a", "pod": "p"}, 1))},
		},
		{
			name:  "incomparable label sets do not match",
			frame: floatFrame("B", data.Labels{"cluster": "a"}),
			captures: capturesOf(
				capture("A", data.Labels{"namespace": "b"}, 1),
			),
			expected: nil,
		},
		{
			name:  "same keys with a different value do not match",
			frame: floatFrame("B", data.Labels{"cluster": "a"}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "b"}, 1),
			),
			expected: nil,
		},
		{
			name:  "equally sized but different key sets do not match",
			frame: floatFrame("B", data.Labels{"cluster": "a", "pod": "p"}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a", "job": "j"}, 1),
			),
			expected: nil,
		},
		{
			name:  "capture with empty labels matches every frame",
			frame: floatFrame("B", data.Labels{"cluster": "a"}),
			captures: capturesOf(
				capture("A", data.Labels{}, 1),
			),
			expected: []string{captureKey(capture("A", data.Labels{}, 1))},
		},
		{
			name:  "empty frame labels match nonempty captures",
			frame: floatFrame("B", data.Labels{}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a"}, 1),
				capture("A", data.Labels{"cluster": "b", "pod": "p"}, 2),
			),
			expected: []string{
				captureKey(capture("A", data.Labels{"cluster": "a"}, 1)),
				captureKey(capture("A", data.Labels{"cluster": "b", "pod": "p"}, 2)),
			},
		},
		{
			name:  "multiple fallback captures of one refID all match",
			frame: floatFrame("B", data.Labels{"cluster": "a", "pod": "p"}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a"}, 1),
				capture("A", data.Labels{"pod": "p"}, 2),
				capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "j"}, 3),
				capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "k"}, 4),
				capture("A", data.Labels{"cluster": "b"}, 5),
			),
			expected: []string{
				captureKey(capture("A", data.Labels{"cluster": "a"}, 1)),
				captureKey(capture("A", data.Labels{"pod": "p"}, 2)),
				captureKey(capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "j"}, 3)),
				captureKey(capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "k"}, 4)),
			},
		},
		{
			name:  "every refID contributes its own matches",
			frame: floatFrame("C", data.Labels{"cluster": "a", "pod": "p"}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a", "pod": "p"}, 1),
				capture("B", data.Labels{"cluster": "a"}, 2),
				capture("C", data.Labels{"cluster": "a", "pod": "p", "job": "j"}, 3),
			),
			expected: []string{
				captureKey(capture("A", data.Labels{"cluster": "a", "pod": "p"}, 1)),
				captureKey(capture("B", data.Labels{"cluster": "a"}, 2)),
				captureKey(capture("C", data.Labels{"cluster": "a", "pod": "p", "job": "j"}, 3)),
			},
		},
		{
			name:  "frames with more than one field are skipped",
			frame: twoFieldFrame("B", data.Labels{"cluster": "a"}),
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a"}, 1),
			),
			expected: nil,
		},
		{
			name:  "frames with no fields are skipped",
			frame: &data.Frame{RefID: "B"},
			captures: capturesOf(
				capture("A", data.Labels{"cluster": "a"}, 1),
			),
			expected: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			attachCaptureValues(data.Frames{tc.frame}, tc.captures)

			require.NotNil(t, tc.frame.Meta, "metadata must always be reset")
			if tc.expected == nil {
				require.Nil(t, tc.frame.Meta.Custom)
				return
			}
			require.ElementsMatch(t, tc.expected, captureKeys(t, tc.frame))
		})
	}

	t.Run("classic condition frames are untouched", func(t *testing.T) {
		matches := []classic.EvalMatch{{Metric: "metric", Value: new(1.0), Labels: data.Labels{"cluster": "a"}}}
		frame := floatFrame("B", data.Labels{"cluster": "a"})
		frame.SetMeta(&data.FrameMeta{Custom: matches})

		attachCaptureValues(data.Frames{frame}, capturesOf(capture("A", data.Labels{"cluster": "a"}, 1)))

		require.Equal(t, matches, frame.Meta.Custom)
	})
}

// TestAttachCaptureValuesMatchesReference compares the matcher with a copy of the loop it
// replaced. It is the main guard for the change: extractEvalString renders every attached
// capture, so the full set of matches of a frame shows up in the evaluation string of an
// alert instance.
func TestAttachCaptureValuesMatchesReference(t *testing.T) {
	const cases = 300

	rnd := rand.New(rand.NewSource(20260805))
	frameCount, captureCount := 0, 0
	unmatched, multiMatched := 0, 0

	for i := range cases {
		specs, captures := randomCaptureCase(rnd)
		frameCount += len(specs)
		for _, byFingerprint := range captures {
			captureCount += len(byFingerprint)
		}

		t.Run(strconv.Itoa(i), func(t *testing.T) {
			want := buildFrames(specs)
			referenceAttachCaptureValues(want, captures)

			got := buildFrames(specs)
			attachCaptureValues(got, captures)

			require.Len(t, got, len(want))
			for j := range want {
				if _, ok := want[j].Meta.Custom.([]classic.EvalMatch); ok {
					require.Equal(t, want[j].Meta.Custom, got[j].Meta.Custom, "frame %d: classic metadata must be kept", j)
					continue
				}
				if want[j].Meta.Custom == nil {
					unmatched++
					require.Nil(t, got[j].Meta.Custom, "frame %d: %s", j, specs[j])
					continue
				}
				expected := captureKeys(t, want[j])
				if len(expected) > 1 {
					multiMatched++
				}
				require.ElementsMatch(t, expected, captureKeys(t, got[j]), "frame %d: %s", j, specs[j])
			}
		})
	}

	// Keep the generator honest. Without these counts it could drift into cases that match
	// nothing, or that always match exactly one capture.
	require.Greater(t, frameCount, 8000)
	require.Greater(t, captureCount, 20000)
	require.Greater(t, unmatched, 800)
	require.Greater(t, multiMatched, 7000)
}

// TestAttachCaptureValuesIsDeterministic checks that the attached captures do not depend
// on the order in which the runtime walks the maps that hold them. Grafana builds the
// evaluation string of an alert instance from those captures, writes it to annotation
// history and sends it to Alertmanager, so it must not change while the data does not.
func TestAttachCaptureValuesIsDeterministic(t *testing.T) {
	frameLabels := data.Labels{"cluster": "a", "pod": "p"}
	list := []NumberValueCapture{
		// Subsets, supersets and captures that share a Var, so that several captures of
		// one RefID match the frame and extractValues has to pick a winner.
		capture("A", data.Labels{"cluster": "a"}, 1),
		capture("A", data.Labels{"pod": "p"}, 2),
		capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "j"}, 3),
		capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "k"}, 4),
		capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "l"}, 5),
		capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "m"}, 6),
		capture("A", data.Labels{"cluster": "a", "pod": "p", "zone": "z"}, 7),
		capture("A", data.Labels{}, 8),
		capture("A", data.Labels{"cluster": "b"}, 9),    // does not match
		capture("A", data.Labels{"namespace": "n"}, 10), // does not match
		capture("C", data.Labels{"cluster": "a", "pod": "p"}, 11),
		capture("D", data.Labels{"cluster": "a", "pod": "p", "job": "j"}, 12),
		capture("D", data.Labels{"cluster": "a", "pod": "p", "job": "k"}, 13),
		capture("D", data.Labels{"cluster": "a"}, 14),
		capture("D", data.Labels{"pod": "p"}, 15),
		capture("D", data.Labels{}, 16),
	}

	rnd := rand.New(rand.NewSource(7))
	var (
		wantOrder  []string
		wantString string
		wantValues map[string]NumberValueCapture
	)
	for i := range 100 {
		shuffled := slices.Clone(list)
		rnd.Shuffle(len(shuffled), func(a, b int) { shuffled[a], shuffled[b] = shuffled[b], shuffled[a] })

		frame := floatFrame("B", frameLabels)
		attachCaptureValues(data.Frames{frame}, capturesOf(shuffled...))

		order := orderedCaptureKeys(t, frame)
		// extractEvalString sorts the captures in place, and extractValues reads them
		// afterwards, exactly as evaluateExecutionResult does.
		evalString, values := extractEvalString(frame), extractValues(frame)

		if i == 0 {
			wantOrder, wantString, wantValues = order, evalString, values
			require.Len(t, wantOrder, 14, "every matching capture must be attached")
			continue
		}
		require.Equal(t, wantOrder, order)
		require.Equal(t, wantString, evalString)
		require.Equal(t, wantValues, values)
	}
}

// TestCaptureIndexRejectsCollidingCandidates checks the comparison that confirms a
// candidate found through a projection fingerprint. Fingerprints are 64 bit, so two
// unrelated label sets can share one and end up in the same place in the index.
func TestCaptureIndexRejectsCollidingCandidates(t *testing.T) {
	frameLabels := data.Labels{"cluster": "a", "pod": "p"}
	keys := sortedLabelKeys(frameLabels, nil)
	fingerprint, _ := projectFingerprint(frameLabels, keys)
	keySet := keySetFingerprint(keys)

	// subsetGroup puts one capture in the bucket a subset of frameLabels would land in,
	// whatever its labels really are. That is what a collision looks like to appendSubsets.
	subsetGroup := func(c NumberValueCapture) []captureGroup {
		subsetKeys := []string{"cluster"}
		projected, ok := projectFingerprint(frameLabels, subsetKeys)
		require.True(t, ok)
		return []captureGroup{{
			keys:          subsetKeys,
			members:       []NumberValueCapture{c},
			byFingerprint: map[data.Fingerprint]NumberValueCapture{projected: c},
		}}
	}

	supersetMatching := capture("A", data.Labels{"cluster": "a", "pod": "p", "job": "j"}, 1)
	supersetColliding := capture("A", data.Labels{"cluster": "b", "pod": "q", "job": "j"}, 2)

	testCases := []struct {
		name string
		// captures is the state the lookup reads.
		captures *refIDCaptures
		// lookup is appendSubsets or appendSupersets, called for frameLabels.
		lookup func(*refIDCaptures) []NumberValueCapture
		// want is the captures the lookup must return.
		want []NumberValueCapture
	}{
		{
			name: "subset candidate of another series is rejected",
			captures: &refIDCaptures{
				byFingerprint: map[data.Fingerprint]NumberValueCapture{},
				grouped:       true,
				groups:        subsetGroup(capture("A", data.Labels{"cluster": "b"}, 1)),
			},
			lookup: func(r *refIDCaptures) []NumberValueCapture {
				return r.appendSubsets(frameLabels, keys, nil)
			},
			want: nil,
		},
		{
			name: "subset candidate of the same series is returned",
			captures: &refIDCaptures{
				byFingerprint: map[data.Fingerprint]NumberValueCapture{},
				grouped:       true,
				groups:        subsetGroup(capture("A", data.Labels{"cluster": "a"}, 2)),
			},
			lookup: func(r *refIDCaptures) []NumberValueCapture {
				return r.appendSubsets(frameLabels, keys, nil)
			},
			want: []NumberValueCapture{capture("A", data.Labels{"cluster": "a"}, 2)},
		},
		{
			name: "superset candidates in one bucket are checked one by one",
			captures: &refIDCaptures{
				byFingerprint: map[data.Fingerprint]NumberValueCapture{},
				grouped:       true,
				groups: []captureGroup{{
					keys:    []string{"cluster", "job", "pod"},
					members: []NumberValueCapture{supersetMatching, supersetColliding},
				}},
				// Both candidates sit in the bucket of the frame's own fingerprint, which
				// is what a collision between their projections would produce.
				supersetIndexes: map[data.Fingerprint][]cachedSupersetIndex{keySet: {{
					keys:     keys,
					captures: map[data.Fingerprint][]NumberValueCapture{fingerprint: {supersetMatching, supersetColliding}},
				}}},
				cached: 1,
			},
			lookup: func(r *refIDCaptures) []NumberValueCapture {
				return r.appendSupersets(frameLabels, keys, keySet, fingerprint, nil)
			},
			want: []NumberValueCapture{supersetMatching},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, tc.lookup(tc.captures))
		})
	}
}

// TestCaptureGroupsByKeySet checks the grouping the fallback lookups are built on.
func TestCaptureGroupsByKeySet(t *testing.T) {
	captures := &refIDCaptures{byFingerprint: capturesOf(
		capture("A", data.Labels{"cluster": "a"}, 1),
		capture("A", data.Labels{"cluster": "b"}, 2),
		capture("A", data.Labels{"cluster": "a", "pod": "p"}, 3),
		capture("A", data.Labels{}, 4),
	)["A"]}

	groups := captures.keySetGroups()
	require.Len(t, groups, 3)
	require.True(t, slices.IsSortedFunc(groups, func(a, b captureGroup) int {
		return len(a.keys) - len(b.keys)
	}), "groups must be sorted by the number of label names they use")
	require.Equal(t, groups[:2], captures.narrowerGroups(2))
	require.Equal(t, groups[2:], captures.widerGroups(1))

	byKeys := map[string]captureGroup{}
	for _, group := range groups {
		byKeys[strings.Join(group.keys, ",")] = group
	}
	for _, tc := range []struct {
		keys    string
		members int
	}{
		{keys: "", members: 1},
		{keys: "cluster", members: 2},
		{keys: "cluster,pod", members: 1},
	} {
		t.Run("group "+tc.keys, func(t *testing.T) {
			require.Len(t, byKeys[tc.keys].members, tc.members)
		})
	}

	// A single group reuses the map the captures already live in.
	one := &refIDCaptures{byFingerprint: capturesOf(
		capture("A", data.Labels{"cluster": "a"}, 1),
		capture("A", data.Labels{"cluster": "b"}, 2),
	)["A"]}
	require.Len(t, one.keySetGroups(), 1)
	require.Equal(t, one.byFingerprint, one.keySetGroups()[0].index())
}

// TestSupersetIndexCache checks that the index is reused for frames that share their
// label names, and that the number of cached indexes stays bounded.
func TestSupersetIndexCache(t *testing.T) {
	captures := &refIDCaptures{byFingerprint: capturesOf(
		capture("A", data.Labels{"cluster": "a", "pod": "p"}, 1),
	)["A"]}

	indexFor := func(names []string) (map[data.Fingerprint][]NumberValueCapture, bool) {
		return captures.supersetIndex(captures.widerGroups(len(names)), names, keySetFingerprint(names))
	}

	keys := []string{"cluster"}
	first, ok := indexFor(keys)
	require.True(t, ok)
	require.Len(t, first, 1)
	// The second call for the same label names returns the same index.
	second, ok := indexFor(keys)
	require.True(t, ok)
	require.Equal(t, reflect.ValueOf(first).Pointer(), reflect.ValueOf(second).Pointer())

	// Captures with as many labels as the frame, or fewer, are not indexed at all.
	require.Empty(t, captures.widerGroups(2))

	for i := range maxCachedSupersetIndexes + 4 {
		indexFor([]string{"cluster" + strconv.Itoa(i)})
	}
	require.Equal(t, maxCachedSupersetIndexes, captures.cached)

	// Once the cache is full, a set of label names that is not in it gets no index and
	// the caller compares labels instead.
	_, ok = indexFor([]string{"pod"})
	require.False(t, ok)
	// Names that are already cached still get their index.
	_, ok = indexFor(keys)
	require.True(t, ok)

	// match reuses one buffer for the label names of every frame, so the cache must copy
	// them. An aliased entry would answer for whichever frame was matched last.
	cached := captures.supersetIndexes[keySetFingerprint(keys)]
	require.Len(t, cached, 1)
	keys[0] = "overwritten"
	require.Equal(t, []string{"cluster"}, cached[0].keys)
}

// TestAttachCaptureValuesBeyondSupersetIndexCache checks the fallback for frames whose
// label names the cache has no room for. Those frames compare labels instead of building
// an index, and must still get the same captures.
func TestAttachCaptureValuesBeyondSupersetIndexCache(t *testing.T) {
	const shapes = maxCachedSupersetIndexes + 5

	specs := make([]frameSpec, 0, shapes)
	list := make([]NumberValueCapture, 0, shapes)
	for i := range shapes {
		// Every frame uses its own label name, so every frame needs its own index, and
		// every frame has one strict superset capture and one capture it cannot match.
		name := "shape" + strconv.Itoa(i)
		specs = append(specs, frameSpec{labels: data.Labels{name: "v"}, fields: 1})
		list = append(list,
			capture("A", data.Labels{name: "v", "pod": "p"}, float64(i)),
			capture("A", data.Labels{name: "other", "pod": "p"}, float64(i)))
	}
	captures := capturesOf(list...)

	want := buildFrames(specs)
	referenceAttachCaptureValues(want, captures)

	got := buildFrames(specs)
	attachCaptureValues(got, captures)

	for i := range want {
		require.Equal(t, []string{captureKey(list[2*i])}, captureKeys(t, want[i]), "frame %d", i)
		require.Equal(t, captureKeys(t, want[i]), captureKeys(t, got[i]), "frame %d", i)
	}
}

func TestCompareCaptures(t *testing.T) {
	ascending := []NumberValueCapture{
		{Var: "A", Labels: data.Labels{"cluster": "a"}, Type: "reduce"},
		{Var: "A", Labels: data.Labels{"cluster": "a"}, Type: "reduce", Value: new(1.0)},
		{Var: "A", Labels: data.Labels{"cluster": "a"}, Type: "reduce", Value: new(2.0)},
		{Var: "A", Labels: data.Labels{"cluster": "a"}, Type: "threshold"},
		{Var: "A", Labels: data.Labels{"cluster": "a", "pod": "p"}, Type: "reduce"},
		{Var: "A", Labels: data.Labels{"cluster": "b"}, Type: "reduce"},
		{Var: "B", Labels: data.Labels{"cluster": "a"}, Type: "reduce"},
	}
	for i := range ascending {
		a := newOrderedCapture(ascending[i])
		require.Zero(t, compareCaptures(a, a), "%d must equal itself", i)
		for j := i + 1; j < len(ascending); j++ {
			b := newOrderedCapture(ascending[j])
			require.Negative(t, compareCaptures(a, b), "%d must sort before %d", i, j)
			require.Positive(t, compareCaptures(b, a), "%d must sort after %d", j, i)
		}
	}

	// A capture of a query and a capture of an expression are told apart.
	expression := newOrderedCapture(NumberValueCapture{Var: "A"})
	query := newOrderedCapture(NumberValueCapture{Var: "A", IsDatasourceNode: true})
	require.Negative(t, compareCaptures(expression, query))
	require.Positive(t, compareCaptures(query, expression))
}

// TestProjectFingerprint pins the helper against the SDK. projectFingerprint repeats the
// FNV-1 parameters and the byte layout of data.Labels.Fingerprint, so the two must agree
// for a projection and a full fingerprint of the same pairs to be comparable.
func TestProjectFingerprint(t *testing.T) {
	labels := data.Labels{"a": "1", "b": "2", "c": "3"}

	testCases := []struct {
		name string
		// labels the projection reads.
		labels data.Labels
		// keys the projection is restricted to, sorted in ascending order.
		keys []string
		// want holds the key/value pairs whose SDK fingerprint the projection must equal.
		// It is only read when present is true.
		want    data.Labels
		present bool
	}{
		{
			name:    "projection onto all keys equals the fingerprint of the label set",
			labels:  labels,
			keys:    []string{"a", "b", "c"},
			want:    labels,
			present: true,
		},
		{
			name:    "projection onto a strict subset equals the fingerprint of that subset",
			labels:  labels,
			keys:    []string{"a", "c"},
			want:    data.Labels{"a": "1", "c": "3"},
			present: true,
		},
		{
			name:    "projection onto no keys equals the fingerprint of empty labels",
			labels:  labels,
			keys:    nil,
			want:    data.Labels{},
			present: true,
		},
		{
			name:    "empty labels project onto no keys",
			labels:  data.Labels{},
			keys:    nil,
			want:    data.Labels{},
			present: true,
		},
		{
			name:    "a missing key is reported instead of hashing a shorter set",
			labels:  data.Labels{"a": "1"},
			keys:    []string{"a", "b"},
			present: false,
		},
		{
			name:    "empty labels report every key as missing",
			labels:  data.Labels{},
			keys:    []string{"a"},
			present: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, present := projectFingerprint(tc.labels, tc.keys)
			require.Equal(t, tc.present, present)
			if !tc.present {
				return
			}
			require.Equal(t, tc.want.Fingerprint(), got)
		})
	}

	t.Run("projections agree with the SDK for random label sets", func(t *testing.T) {
		rnd := rand.New(rand.NewSource(1))
		names := []string{"cluster", "namespace", "pod", "job", "instance", "__name__", "", "ünïcode"}
		for range 500 {
			full := data.Labels{}
			for _, i := range rnd.Perm(len(names))[:1+rnd.Intn(len(names)-1)] {
				full[names[i]] = strconv.Itoa(rnd.Intn(10))
			}
			keys := sortedLabelKeys(full, nil)
			keys = keys[:1+rnd.Intn(len(keys))]

			projected := data.Labels{}
			for _, name := range keys {
				projected[name] = full[name]
			}

			got, present := projectFingerprint(full, keys)
			require.True(t, present)
			require.Equal(t, projected.Fingerprint(), got, "labels=%v keys=%v", full, keys)
		}
	})
}

func TestKeySetFingerprint(t *testing.T) {
	testCases := []struct {
		name  string
		a, b  []string
		equal bool
	}{
		{
			name:  "the same names hash the same",
			a:     []string{"a", "b"},
			b:     []string{"a", "b"},
			equal: true,
		},
		{
			name: "different names hash differently",
			a:    []string{"a", "b"},
			b:    []string{"a", "c"},
		},
		{
			// Names are separated, so a key set is not confused with a longer name.
			name: "two names do not hash as their concatenation",
			a:    []string{"a", "b"},
			b:    []string{"ab"},
		},
		{
			name: "a name is not dropped for being empty",
			a:    []string{"a", ""},
			b:    []string{"a"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.equal {
				require.Equal(t, keySetFingerprint(tc.a), keySetFingerprint(tc.b))
				return
			}
			require.NotEqual(t, keySetFingerprint(tc.a), keySetFingerprint(tc.b))
		})
	}
}

func TestSortedLabelKeys(t *testing.T) {
	testCases := []struct {
		name   string
		labels data.Labels
		// buf is the buffer to append to, as match reuses one across frames.
		buf  []string
		want []string
	}{
		{
			name:   "names are sorted",
			labels: data.Labels{"c": "3", "a": "1", "b": "2"},
			want:   []string{"a", "b", "c"},
		},
		{
			name:   "empty labels give no names",
			labels: data.Labels{},
			want:   nil,
		},
		{
			name:   "a reused buffer keeps only the new names",
			labels: data.Labels{"c": "3"},
			buf:    []string{"a", "b"},
			want:   []string{"c"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, sortedLabelKeys(tc.labels, tc.buf[:0]))
		})
	}
}

// referenceAttachCaptureValues is a copy of the capture matching loop as it was before
// the projection index replaced it. Tests compare the two implementations.
func referenceAttachCaptureValues(frames data.Frames, captures capturesByRefID) {
	for _, frame := range frames {
		if frame.Meta != nil && frame.Meta.Custom != nil {
			if _, ok := frame.Meta.Custom.([]classic.EvalMatch); ok {
				continue // do not overwrite EvalMatch from classic condition.
			}
		}

		frame.SetMeta(&data.FrameMeta{}) // overwrite metadata

		if len(frame.Fields) == 1 {
			theseLabels := frame.Fields[0].Labels
			fp := theseLabels.Fingerprint()

			for _, fps := range captures {
				// First look for a capture whose labels are an exact match
				if v, ok := fps[fp]; ok {
					if frame.Meta.Custom == nil {
						frame.Meta.Custom = []NumberValueCapture{}
					}
					frame.Meta.Custom = append(frame.Meta.Custom.([]NumberValueCapture), v)
				} else {
					// If no exact match was found, look for captures whose labels are either subsets
					// or supersets
					for _, v := range fps {
						// matching labels are equal labels, or when one set of labels includes the labels of the other.
						if theseLabels.Equals(v.Labels) || theseLabels.Contains(v.Labels) || v.Labels.Contains(theseLabels) {
							if frame.Meta.Custom == nil {
								frame.Meta.Custom = []NumberValueCapture{}
							}
							frame.Meta.Custom = append(frame.Meta.Custom.([]NumberValueCapture), v)
						}
					}
				}
			}
		}
	}
}

// frameSpec describes a condition frame so that the same frame can be built twice, once
// for each implementation under comparison.
type frameSpec struct {
	labels data.Labels
	// fields is the number of fields of the frame. Only frames with a single field take
	// part in capture matching.
	fields int
	// classic marks a frame that already carries the metadata of a classic condition.
	classic bool
}

func (s frameSpec) String() string {
	return fmt.Sprintf("labels={%s} fields=%d classic=%t", s.labels, s.fields, s.classic)
}

func buildFrames(specs []frameSpec) data.Frames {
	frames := make(data.Frames, 0, len(specs))
	for _, spec := range specs {
		var frame *data.Frame
		switch spec.fields {
		case 0:
			frame = &data.Frame{RefID: "B"}
		case 1:
			frame = floatFrame("B", spec.labels)
		default:
			frame = twoFieldFrame("B", spec.labels)
		}
		if spec.classic {
			frame.SetMeta(&data.FrameMeta{Custom: []classic.EvalMatch{{
				Metric: "metric", Value: new(1.0), Labels: spec.labels,
			}}})
		}
		frames = append(frames, frame)
	}
	return frames
}

// randomCaptureCase generates condition frames and captures that cover exact, subset,
// superset, empty, incomparable and multiple matches, as well as classic frames and
// frames of a shape that cannot hold captures.
//
// The alphabet is wide enough that two label sets can differ in a name, in a value, or in
// both, and label sets range from empty to wider than any frame. Names that sort around
// the same neighbourhood, and names that are a prefix of another, are in the list because
// projectFingerprint hashes sorted names with a separator between them.
func randomCaptureCase(rnd *rand.Rand) ([]frameSpec, capturesByRefID) {
	keys := []string{
		"cluster", "namespace", "pod", "job", "instance", "__name__",
		"zone", "region", "", "pod_name", "po", "ünïcode",
	}
	values := []string{"a", "b", "c", "", "aa", "ünïcode"}

	randomLabels := func(size int) data.Labels {
		labels := make(data.Labels, size)
		for _, i := range rnd.Perm(len(keys))[:size] {
			labels[keys[i]] = values[rnd.Intn(len(values))]
		}
		return labels
	}

	specs := make([]frameSpec, 0, 40)
	for range 20 + rnd.Intn(20) {
		spec := frameSpec{labels: randomLabels(rnd.Intn(6)), fields: 1}
		switch rnd.Intn(20) {
		case 0:
			spec.classic = true
		case 1:
			spec.fields = 2
		case 2:
			spec.fields = 0
		}
		specs = append(specs, spec)
	}

	captures := capturesByRefID{}
	for _, refID := range []string{"A", "C", "D"} {
		for range 20 + rnd.Intn(20) {
			labels := randomLabels(rnd.Intn(8))
			// Half of the captures start from the labels of a condition frame, so that
			// exact, subset and superset matches all occur.
			if len(specs) > 0 && rnd.Intn(2) == 0 {
				labels = specs[rnd.Intn(len(specs))].labels.Copy()
				switch rnd.Intn(5) {
				case 0: // one name more
					labels[keys[rnd.Intn(len(keys))]] = values[rnd.Intn(len(values))]
				case 1: // one name fewer
					for k := range labels {
						delete(labels, k)
						break
					}
				case 2: // the same names, one value changed
					for k := range labels {
						labels[k] = values[rnd.Intn(len(values))]
						break
					}
				case 3: // one name swapped for another
					for k := range labels {
						delete(labels, k)
						labels[keys[rnd.Intn(len(keys))]] = values[rnd.Intn(len(values))]
						break
					}
				}
			}
			addCapture(captures, capture(refID, labels, rnd.Float64()))
		}
	}
	return specs, captures
}

func floatFrame(refID string, labels data.Labels) *data.Frame {
	return &data.Frame{
		RefID:  refID,
		Fields: data.Fields{data.NewField("Value", labels, []*float64{new(1.0)})},
	}
}

func twoFieldFrame(refID string, labels data.Labels) *data.Frame {
	frame := floatFrame(refID, labels)
	frame.Fields = append(frame.Fields, data.NewField("Value2", labels, []*float64{new(2.0)}))
	return frame
}

func capture(refID string, labels data.Labels, value float64) NumberValueCapture {
	return NumberValueCapture{
		Var:    refID,
		Labels: labels,
		Type:   "reduce",
		Value:  &value,
	}
}

func capturesOf(list ...NumberValueCapture) capturesByRefID {
	captures := capturesByRefID{}
	for _, c := range list {
		addCapture(captures, c)
	}
	return captures
}

func addCapture(captures capturesByRefID, c NumberValueCapture) {
	byFingerprint := captures[c.Var]
	if byFingerprint == nil {
		byFingerprint = map[data.Fingerprint]NumberValueCapture{}
		captures[c.Var] = byFingerprint
	}
	byFingerprint[c.Labels.Fingerprint()] = c
}

// captureKey identifies a capture by everything a reader of Meta.Custom can observe.
func captureKey(c NumberValueCapture) string {
	value := "null"
	if c.Value != nil {
		value = strconv.FormatFloat(*c.Value, 'g', -1, 64)
	}
	return fmt.Sprintf("var=%s labels={%s} type=%s datasource=%t value=%s", c.Var, c.Labels, c.Type, c.IsDatasourceNode, value)
}

// orderedCaptureKeys returns the attached captures in the order they were attached in.
func orderedCaptureKeys(t *testing.T, frame *data.Frame) []string {
	t.Helper()
	captures, ok := frame.Meta.Custom.([]NumberValueCapture)
	require.True(t, ok, "frame metadata must hold captures, got %T", frame.Meta.Custom)
	keys := make([]string, 0, len(captures))
	for _, c := range captures {
		keys = append(keys, captureKey(c))
	}
	return keys
}

func captureKeys(t *testing.T, frame *data.Frame) []string {
	t.Helper()
	keys := orderedCaptureKeys(t, frame)
	sort.Strings(keys)
	return keys
}
