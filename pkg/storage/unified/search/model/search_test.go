package model

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestRequiredIndexFeaturesAreCurrent guards the invariant that makes required
// features safe: requiring a feature this binary never records would rebuild
// every index on every check, forever.
func TestRequiredIndexFeaturesAreCurrent(t *testing.T) {
	for _, postRankAuthz := range []bool{false, true} {
		for _, required := range RequiredIndexFeatures(postRankAuthz) {
			require.Contains(t, CurrentIndexFeatures(), required)
		}
	}
}

// Asserts both halves, so requiring the feature — which rebuilds every existing
// index — cannot happen by accident.
func TestStoredResourceVersionIsRecordedButNotRequired(t *testing.T) {
	require.Contains(t, CurrentIndexFeatures(), IndexFeatureStoredResourceVersion)
	for _, postRankAuthz := range []bool{false, true} {
		require.NotContains(t, RequiredIndexFeatures(postRankAuthz), IndexFeatureStoredResourceVersion)
	}
}

func TestSortableTrashResourceVersionIsRecordedButNotRequired(t *testing.T) {
	require.Contains(t, CurrentIndexFeatures(), IndexFeatureSortableTrashResourceVersion)
	require.NotContains(t, TrashIndexFeatures(), IndexFeatureSortableTrashResourceVersion)
	for _, postRankAuthz := range []bool{false, true} {
		require.NotContains(t, RequiredIndexFeatures(postRankAuthz), IndexFeatureSortableTrashResourceVersion)
	}
}

// Every index built now keeps deleted documents, and records it, so a reader can
// tell it from an older index that keeps none.
func TestCurrentIndexFeaturesHoldDeletedDocuments(t *testing.T) {
	require.Contains(t, CurrentIndexFeatures(), IndexFeatureHoldsDeletedDocuments)
	require.Contains(t, IndexReaderRequirements(), IndexFeatureHoldsDeletedDocuments)
}

// Anything this binary builds with, it must also know how to read, or it would
// refuse its own indexes.
func TestKnownIndexFeaturesCoverCurrent(t *testing.T) {
	for _, current := range CurrentIndexFeatures() {
		require.Contains(t, knownIndexFeatures, current)
	}
}

// Declaring a requirement this binary cannot read would reject every index it
// builds.
func TestReaderRequiredFeaturesAreKnown(t *testing.T) {
	require.Empty(t, UnknownIndexRequirements(IndexReaderRequirements()))
}

func TestUnknownIndexRequirements(t *testing.T) {
	// An index built before requirements were recorded.
	require.Empty(t, UnknownIndexRequirements(nil))

	// Refused by name, so an older instance needs no knowledge of the feature.
	require.Equal(t, []IndexFeature{"feature-from-the-future"},
		UnknownIndexRequirements([]IndexFeature{IndexFeatureDeletedMarker, "feature-from-the-future"}))
}

// TestRequiredIndexFeaturesStoredFacets covers the gating that keeps the stored
// facet mapping from rebuilding indexes where post-rank authorization is off.
func TestRequiredIndexFeaturesStoredFacets(t *testing.T) {
	require.NotContains(t, RequiredIndexFeatures(false), IndexFeatureStoredFacets)
	require.Contains(t, RequiredIndexFeatures(true), IndexFeatureStoredFacets)

	// An index built before the stored facet mapping is reused with the option
	// off, and rebuilt once it is on.
	buildInfo := IndexBuildInfo{Features: slices.Concat(TrashIndexFeatures(), []IndexFeature{IndexFeatureHoldsDeletedDocuments})}
	require.Empty(t, MissingIndexFeatures(buildInfo, RequiredIndexFeatures(false)))
	require.Equal(t, []IndexFeature{IndexFeatureStoredFacets}, MissingIndexFeatures(buildInfo, RequiredIndexFeatures(true)))
}

// An index missing the trash mappings must be rebuilt rather than serve an empty
// trash, whatever the facet option is set to.
func TestTrashIndexFeaturesAreRequired(t *testing.T) {
	buildInfo := IndexBuildInfo{Features: []IndexFeature{IndexFeatureStoredFacets}}
	want := slices.Sorted(slices.Values(slices.Concat(TrashIndexFeatures(), []IndexFeature{IndexFeatureHoldsDeletedDocuments})))
	for _, postRankAuthz := range []bool{false, true} {
		require.Equal(t, want, MissingIndexFeatures(buildInfo, RequiredIndexFeatures(postRankAuthz)))
	}
}

// An index that maps the trash fields but was built before deleted documents were kept
// holds none, so it has to rebuild rather than report an empty trash.
func TestHoldingDeletedDocumentsIsRequired(t *testing.T) {
	buildInfo := IndexBuildInfo{Features: TrashIndexFeatures()}
	require.Equal(t,
		[]IndexFeature{IndexFeatureHoldsDeletedDocuments},
		MissingIndexFeatures(buildInfo, RequiredIndexFeatures(false)))
}
