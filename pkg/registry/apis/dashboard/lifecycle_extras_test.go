package dashboard

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLifecycleDefaultsToNoop(t *testing.T) {
	t.Run("builder without extras falls back to the no-op", func(t *testing.T) {
		b := &DashboardsAPIBuilder{}
		require.Equal(t, NoopDashboardLifecycleExtras{}, b.lifecycle())
	})

	t.Run("no-op neither changes nor rejects anything and does not hide drafts", func(t *testing.T) {
		extras := ProvideNoopDashboardLifecycleExtras()
		require.NoError(t, extras.Mutate(t.Context(), nil))
		require.NoError(t, extras.Validate(t.Context(), nil))
		require.False(t, extras.HideDraftsByDefault(t.Context()))
	})
}
