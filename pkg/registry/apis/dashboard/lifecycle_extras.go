package dashboard

import (
	"context"

	"k8s.io/apiserver/pkg/admission"
)

// DashboardLifecycleExtras lets other builds (Enterprise) own the dashboard lifecycle (draft/published).
// The OSS build ships a no-op implementation, so drafts are neither validated nor hidden.
type DashboardLifecycleExtras interface {
	Mutate(ctx context.Context, a admission.Attributes) error
	Validate(ctx context.Context, a admission.Attributes) error
}

type NoopDashboardLifecycleExtras struct{}

func (NoopDashboardLifecycleExtras) Mutate(context.Context, admission.Attributes) error   { return nil }
func (NoopDashboardLifecycleExtras) Validate(context.Context, admission.Attributes) error { return nil }

func ProvideNoopDashboardLifecycleExtras() DashboardLifecycleExtras {
	return NoopDashboardLifecycleExtras{}
}

func (b *DashboardsAPIBuilder) lifecycle() DashboardLifecycleExtras {
	if b.lifecycleExtras == nil {
		return NoopDashboardLifecycleExtras{}
	}
	return b.lifecycleExtras
}
