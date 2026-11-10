package dashboard

import (
	"context"
	"errors"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/admission"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type recordingLifecycleExtras struct {
	mutateErr, validateErr     error
	mutateCalls, validateCalls int
}

func (r *recordingLifecycleExtras) Mutate(context.Context, admission.Attributes) error {
	r.mutateCalls++
	return r.mutateErr
}

func (r *recordingLifecycleExtras) Validate(context.Context, admission.Attributes) error {
	r.validateCalls++
	return r.validateErr
}

func (r *recordingLifecycleExtras) HideDraftsByDefault(context.Context) bool { return false }

func dashboardAttrs(op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		&dashv0.Dashboard{ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"}},
		nil,
		dashv0.DashboardResourceInfo.GroupVersionKind(),
		"default",
		"test",
		dashv0.DashboardResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
		nil,
	)
}

func TestLifecycleExtrasAdmission(t *testing.T) {
	ctx := context.Background()
	boom := errors.New("lifecycle rejected")

	t.Run("Mutate calls the lifecycle on dashboard create and update", func(t *testing.T) {
		for _, op := range []admission.Operation{admission.Create, admission.Update} {
			fake := &recordingLifecycleExtras{}
			b := &DashboardsAPIBuilder{lifecycleExtras: fake}
			require.NoError(t, b.Mutate(ctx, dashboardAttrs(op), nil))
			require.Equal(t, 1, fake.mutateCalls, op)
		}
	})

	t.Run("Mutate returns the lifecycle error", func(t *testing.T) {
		fake := &recordingLifecycleExtras{mutateErr: boom}
		b := &DashboardsAPIBuilder{lifecycleExtras: fake}
		require.ErrorIs(t, b.Mutate(ctx, dashboardAttrs(admission.Create), nil), boom)
	})

	t.Run("Mutate does not call the lifecycle on delete", func(t *testing.T) {
		fake := &recordingLifecycleExtras{}
		b := &DashboardsAPIBuilder{lifecycleExtras: fake}
		require.NoError(t, b.Mutate(ctx, dashboardAttrs(admission.Delete), nil))
		require.Zero(t, fake.mutateCalls)
	})

	t.Run("Mutate does not call the lifecycle for other resources", func(t *testing.T) {
		fake := &recordingLifecycleExtras{}
		b := &DashboardsAPIBuilder{lifecycleExtras: fake}
		a := admission.NewAttributesRecord(
			&dashv0.Snapshot{ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"}},
			nil,
			dashv0.SnapshotResourceInfo.GroupVersionKind(),
			"default",
			"test",
			dashv0.SnapshotResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			nil,
			false,
			nil,
		)
		require.NoError(t, b.Mutate(ctx, a, nil))
		require.Zero(t, fake.mutateCalls)
	})

	t.Run("Validate calls the lifecycle on dashboard create and update and returns its error", func(t *testing.T) {
		for _, op := range []admission.Operation{admission.Create, admission.Update} {
			fake := &recordingLifecycleExtras{validateErr: boom}
			b := &DashboardsAPIBuilder{lifecycleExtras: fake}
			require.ErrorIs(t, b.Validate(ctx, dashboardAttrs(op), nil), boom, op)
			require.Equal(t, 1, fake.validateCalls, op)
		}
	})

	t.Run("Validate does not call the lifecycle on delete", func(t *testing.T) {
		fake := &recordingLifecycleExtras{validateErr: boom}
		b := &DashboardsAPIBuilder{lifecycleExtras: fake}
		_ = b.Validate(ctx, dashboardAttrs(admission.Delete), nil)
		require.Zero(t, fake.validateCalls)
	})

	t.Run("Validate does not call the lifecycle for other resources", func(t *testing.T) {
		fake := &recordingLifecycleExtras{validateErr: boom}
		b := &DashboardsAPIBuilder{lifecycleExtras: fake}
		a := admission.NewAttributesRecord(
			&dashv0.Snapshot{ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"}},
			nil,
			dashv0.SnapshotResourceInfo.GroupVersionKind(),
			"default",
			"test",
			dashv0.SnapshotResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			nil,
			false,
			nil,
		)
		_ = b.Validate(ctx, a, nil)
		require.Zero(t, fake.validateCalls)
	})
}

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

func TestNewAPIServiceWiresLifecycleExtras(t *testing.T) {
	extras := hideDraftsExtras{}
	search := &SearchHandler{}
	b := NewAPIService(authlib.FixedAccessClient(true), nil, testutil.NewDataSourceProvider(testutil.StandardTestConfig), testutil.NewLibraryElementProvider(), nil, search, nil, nil, extras)

	require.Equal(t, extras, b.lifecycleExtras)
	require.Equal(t, extras, search.lifecycleExtras)
}
