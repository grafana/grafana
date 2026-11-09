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
	// HideDraftsByDefault reports whether list and search requests in the request namespace
	// should exclude draft dashboards unless the caller explicitly asks for them.
	HideDraftsByDefault(ctx context.Context) bool
}

type NoopDashboardLifecycleExtras struct{}

func (NoopDashboardLifecycleExtras) Mutate(context.Context, admission.Attributes) error   { return nil }
func (NoopDashboardLifecycleExtras) Validate(context.Context, admission.Attributes) error { return nil }
func (NoopDashboardLifecycleExtras) HideDraftsByDefault(context.Context) bool             { return false }

func ProvideNoopDashboardLifecycleExtras() DashboardLifecycleExtras {
	return NoopDashboardLifecycleExtras{}
}

func (b *DashboardsAPIBuilder) lifecycle() DashboardLifecycleExtras {
	if b.lifecycleExtras == nil {
		return NoopDashboardLifecycleExtras{}
	}
	return b.lifecycleExtras
}
