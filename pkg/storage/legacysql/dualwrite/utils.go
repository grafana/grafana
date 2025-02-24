package dualwrite

import (
	"golang.org/x/net/context"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

func IsReadingLegacyDashboardsAndFolders(ctx context.Context, svc Service) bool {
	f, _ := svc.ReadFromUnified(ctx, folders.FolderResourceInfo.GroupResource())
	d, _ := svc.ReadFromUnified(ctx, schema.GroupResource{
		Group:    dashboard.GROUP,
		Resource: dashboard.DASHBOARD_RESOURCE,
	})
	return !(f && d)
}
