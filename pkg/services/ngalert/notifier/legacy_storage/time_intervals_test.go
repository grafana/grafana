package legacy_storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func TestConfigRevision_SetTimeInterval(t *testing.T) {
	t.Run("stores the interval under the UID it was given, without generating one", func(t *testing.T) {
		rev := &ConfigRevision{Config: &v1.AMConfigV1{}}

		result := rev.SetTimeInterval(v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{UID: "explicit-uid"},
			Title:            "weekends",
		})

		assert.Equal(t, v1.ResourceUID("explicit-uid"), result.UID)
		stored, ok := rev.Config.TimeIntervals["explicit-uid"]
		require.True(t, ok)
		assert.Equal(t, "weekends", stored.Title)
	})

	t.Run("preserves an existing UID across a rename instead of re-deriving it from the new title", func(t *testing.T) {
		rev := &ConfigRevision{Config: &v1.AMConfigV1{}}
		created := rev.SetTimeInterval(v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("weekends")},
			Title:            "weekends",
		})

		renamed := rev.SetTimeInterval(v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{UID: created.UID},
			Title:            "another-name",
		})

		assert.Equal(t, created.UID, renamed.UID)
		assert.NotEqual(t, v1.TimeIntervalUID("another-name"), renamed.UID)

		stored, ok := rev.Config.TimeIntervals[created.UID]
		require.True(t, ok, "renamed interval should still be present under its original UID")
		assert.Equal(t, "another-name", stored.Title)

		_, staleEntry := rev.Config.TimeIntervals[v1.TimeIntervalUID("another-name")]
		assert.False(t, staleEntry, "renaming must not create a second entry under a fresh name-derived UID")
	})
}
