package dashboard

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

func TestApplyDraftListSelector(t *testing.T) {
	draft := labels.Set{utils.LabelKeyLifecycle: utils.LifecycleDraft}
	published := labels.Set{}

	tests := []struct {
		name           string
		selector       string
		hide           bool
		want           string
		matchDraft     bool
		matchPublished bool
	}{
		{name: "noop when not hiding", selector: "", hide: false, want: "", matchDraft: true, matchPublished: true},
		{name: "hide drafts by default", selector: "", hide: true, want: "grafana.app/lifecycle notin (draft)", matchDraft: false, matchPublished: true},
		{name: "include-drafts opts in", selector: "grafana.app/include-drafts=true", hide: true, want: "", matchDraft: true, matchPublished: true},
		{name: "include-drafts is stripped when not hiding", selector: "grafana.app/include-drafts=true", hide: false, want: "", matchDraft: true, matchPublished: true},
		{name: "explicit lifecycle is kept", selector: "grafana.app/lifecycle=draft", hide: true, want: "grafana.app/lifecycle=draft", matchDraft: true, matchPublished: false},
		{name: "trash is left alone", selector: "grafana.app/get-trash=true", hide: true, want: "grafana.app/get-trash=true"},
		{name: "other labels are kept", selector: "team=a", hide: true, want: "grafana.app/lifecycle notin (draft),team=a"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sel, err := labels.Parse(tt.selector)
			require.NoError(t, err)
			got := applyDraftListSelector(sel, tt.hide)
			require.Equal(t, tt.want, got.String())
			if tt.matchDraft || tt.matchPublished {
				require.Equal(t, tt.matchDraft, got.Matches(draft))
				require.Equal(t, tt.matchPublished, got.Matches(published))
			}
		})
	}

	require.Equal(t, "grafana.app/lifecycle notin (draft)", applyDraftListSelector(nil, true).String())
}

func TestDraftSearchRequirement(t *testing.T) {
	require.Nil(t, draftSearchRequirement("", false))
	require.Nil(t, draftSearchRequirement("all", true))

	r := draftSearchRequirement("", true)
	require.Equal(t, utils.LabelKeyLifecycle, r.Key)
	require.Equal(t, string(selection.NotIn), r.Operator)
	require.Equal(t, []string{utils.LifecycleDraft}, r.Values)

	r = draftSearchRequirement("draft", false)
	require.Equal(t, string(selection.Equals), r.Operator)
}
