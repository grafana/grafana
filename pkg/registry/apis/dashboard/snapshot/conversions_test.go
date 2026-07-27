package snapshot

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func TestConvertK8sResourceToCreateCommand_Expires(t *testing.T) {
	const orgID, userID int64 = 1, 2
	const oneWeekSeconds = int64(7 * 24 * 60 * 60)

	t.Run("converts absolute ms timestamp back to seconds-remaining duration", func(t *testing.T) {
		oneWeekFromNow := time.Now().Add(7 * 24 * time.Hour).UnixMilli()
		snap := &dashV0.Snapshot{
			Spec: dashV0.SnapshotSpec{Expires: &oneWeekFromNow},
		}

		cmd := convertK8sResourceToCreateCommand(snap, orgID, userID)

		assert.InDelta(t, oneWeekSeconds, cmd.Expires, 5,
			"cmd.Expires should be ~1 week in seconds, got %d", cmd.Expires)
	})

	t.Run("leaves Expires zero when spec has no expiration", func(t *testing.T) {
		snap := &dashV0.Snapshot{Spec: dashV0.SnapshotSpec{}}

		cmd := convertK8sResourceToCreateCommand(snap, orgID, userID)

		assert.Equal(t, int64(0), cmd.Expires)
	})

	t.Run("leaves Expires zero when spec timestamp is in the past", func(t *testing.T) {
		past := time.Now().Add(-time.Hour).UnixMilli()
		snap := &dashV0.Snapshot{Spec: dashV0.SnapshotSpec{Expires: &past}}

		cmd := convertK8sResourceToCreateCommand(snap, orgID, userID)

		assert.Equal(t, int64(0), cmd.Expires)
	})

	t.Run("round-trip create cmd -> k8s -> create cmd preserves ~1 week", func(t *testing.T) {
		original := &dashboardsnapshots.CreateDashboardSnapshotCommand{}
		original.Expires = oneWeekSeconds

		snap := convertCreateCmdToK8sSnapshot(original, "default")
		got := convertK8sResourceToCreateCommand(snap, orgID, userID)

		assert.InDelta(t, original.Expires, got.Expires, 5)
	})
}
