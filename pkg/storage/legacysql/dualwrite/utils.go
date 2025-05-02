package dualwrite

import (
	"golang.org/x/net/context"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
)

func IsReadingLegacyDashboardsAndFolders(ctx context.Context, svc Service) bool {
	f, _ := svc.ReadFromUnified(ctx, folders.FolderResourceInfo.GroupResource())
	d, _ := svc.ReadFromUnified(ctx, schema.GroupResource{
		Group:    dashboard.GROUP,
		Resource: dashboard.DASHBOARD_RESOURCE,
	})
	return !f || !d
}
