package dashboard

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// dashboardStoragePermissionWrapper is a wrapper around the grafanarest.Storage that adds dashboard permissions handling
// when dual writing is enabled.
type dashboardStoragePermissionWrapper struct {
	dashboardPermissionsSvc accesscontrol.DashboardPermissionsService
	grafanarest.Storage
}

func (d dashboardStoragePermissionWrapper) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	obj, async, err := d.Storage.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		return obj, async, err
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return obj, async, err
	}
	if accessErr := d.dashboardPermissionsSvc.DeleteResourcePermissions(ctx, info.OrgID, name); accessErr != nil {
		return obj, async, accessErr
	}
	return obj, async, nil
}
