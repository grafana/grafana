package migrator

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestToBackfillRecord(t *testing.T) {
	const ns = "stacks-123"

	t.Run("maps a fully-populated annotation", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{
			ID:           42,
			Epoch:        1000,
			EpochEnd:     2000,
			DashboardUID: "dash-uid",
			PanelID:      7,
			Text:         "deploy",
			Data:         `{"foo":"bar"}`,
			Created:      500,
			UserUID:      "user-uid",
			Tags:         []string{"a", "team:ops"},
		})

		require.Equal(t, ns, rec.Namespace)
		require.Equal(t, "legacy-42", rec.Name)
		require.Equal(t, int64(42), rec.LegacyID)
		require.Equal(t, int64(1000), rec.Time)
		require.NotNil(t, rec.TimeEnd)
		require.Equal(t, int64(2000), *rec.TimeEnd)
		require.NotNil(t, rec.DashboardUID)
		require.Equal(t, "dash-uid", *rec.DashboardUID)
		require.NotNil(t, rec.PanelID)
		require.Equal(t, int64(7), *rec.PanelID)
		require.Equal(t, "deploy", rec.Text)
		require.Equal(t, []string{"a", "team:ops"}, rec.Tags)
		require.Equal(t, "user:user-uid", rec.CreatedBy)
		require.Equal(t, time.UnixMilli(500).UTC(), rec.CreatedAt)
		require.NotNil(t, rec.LegacyData)
		require.Equal(t, `{"foo":"bar"}`, *rec.LegacyData)
	})

	t.Run("time_end unset when zero", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1000, EpochEnd: 0})
		require.Nil(t, rec.TimeEnd)
	})

	t.Run("time_end dropped when before time (would violate CHECK)", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 2000, EpochEnd: 1000})
		require.Nil(t, rec.TimeEnd)
	})

	t.Run("time_end dropped when equal to time (point annotation)", func(t *testing.T) {
		// Legacy stores epoch_end == epoch for points; these must map to a nil
		// TimeEnd so migrated points match natively-created ones.
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1000, EpochEnd: 1000})
		require.Nil(t, rec.TimeEnd)
	})

	t.Run("time_end kept when after time (region annotation)", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1000, EpochEnd: 2000})
		require.NotNil(t, rec.TimeEnd)
		require.Equal(t, int64(2000), *rec.TimeEnd)
	})

	t.Run("empty dashboard uid and zero panel id become nil", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1000, DashboardUID: "", PanelID: 0})
		require.Nil(t, rec.DashboardUID)
		require.Nil(t, rec.PanelID)
	})

	t.Run("created_at falls back to time when unset", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1234, Created: 0})
		require.Equal(t, time.UnixMilli(1234).UTC(), rec.CreatedAt)
	})

	t.Run("anonymous creator yields empty created_by", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1000, UserUID: ""})
		require.Equal(t, "", rec.CreatedBy)
	})

	t.Run("user creator gets user-typed created_by", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1000, UserUID: "abc"})
		require.Equal(t, "user:abc", rec.CreatedBy)
	})

	t.Run("service-account creator gets service-account-typed created_by", func(t *testing.T) {
		rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1000, UserUID: "sa-1", UserIsServiceAccount: true})
		require.Equal(t, "service-account:sa-1", rec.CreatedBy)
	})

	t.Run("trivial legacy data is dropped", func(t *testing.T) {
		for _, data := range []string{"", "  ", "{}", "[]", "null"} {
			rec := toBackfillRecord(ns, LegacyAnnotation{ID: 1, Epoch: 1000, Data: data})
			require.Nil(t, rec.LegacyData, "data %q should be dropped", data)
		}
	})
}

func TestLegacyName(t *testing.T) {
	require.Equal(t, "legacy-1", legacyName(1))
	require.Equal(t, "legacy-999999", legacyName(999999))
}
