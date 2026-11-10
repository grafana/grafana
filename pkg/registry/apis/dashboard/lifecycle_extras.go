package dashboard

import (
	"context"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

func (NoopDashboardLifecycleExtras) HideDraftsByDefault(context.Context) bool { return false }

func ProvideNoopDashboardLifecycleExtras() DashboardLifecycleExtras {
	return NoopDashboardLifecycleExtras{}
}

func (b *DashboardsAPIBuilder) lifecycle() DashboardLifecycleExtras {
	if b.lifecycleExtras == nil {
		return NoopDashboardLifecycleExtras{}
	}
	return b.lifecycleExtras
}

// applyDraftListSelector strips the request-only include-drafts flag and, when drafts are hidden
// by default, excludes them unless the selector already targets lifecycle, trash or history.
// `notin` is used instead of `!=` because only `notin` is pushed down to the search index.
func applyDraftListSelector(sel labels.Selector, hideDrafts bool) labels.Selector {
	if sel == nil {
		sel = labels.Everything()
	}
	reqs, _ := sel.Requirements()

	includeDrafts := false
	explicit := false
	kept := make([]labels.Requirement, 0, len(reqs)+1)
	for _, r := range reqs {
		switch r.Key() {
		case utils.LabelKeyIncludeDrafts:
			includeDrafts = true
			continue
		case utils.LabelKeyLifecycle, utils.LabelKeyGetTrash, utils.LabelKeyGetHistory:
			explicit = true
		}
		kept = append(kept, r)
	}

	if !includeDrafts && !hideDrafts {
		return sel
	}
	if hideDrafts && !includeDrafts && !explicit {
		r, err := labels.NewRequirement(utils.LabelKeyLifecycle, selection.NotIn, []string{utils.LifecycleDraft})
		if err == nil {
			kept = append(kept, *r)
		}
	}
	return labels.NewSelector().Add(kept...)
}
