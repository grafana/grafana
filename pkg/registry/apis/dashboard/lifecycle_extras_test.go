package dashboard

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
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

	t.Run("no-op neither changes nor rejects anything", func(t *testing.T) {
		extras := ProvideNoopDashboardLifecycleExtras()
		require.NoError(t, extras.Mutate(t.Context(), nil))
		require.NoError(t, extras.Validate(t.Context(), nil))
	})
}
