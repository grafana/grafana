package dashboardpreferences

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// DeleteFolderPreferences deletes folder-<folderUID> in namespace through client, which must be for
// dashboardpreferences, with options. It runs as Grafana's service identity limited to namespace, so the
// tier is deleted while grafana.dashboardPreferences is off and whether or not the folder's deleter can
// edit it. A missing object is not an error. A server that doesn't serve dashboardpreferences returns an
// error that wraps ErrNotServed.
func DeleteFolderPreferences(ctx context.Context, client dynamic.NamespaceableResourceInterface, namespace, folderUID string, options metav1.DeleteOptions) error {
	if err := validateNamespace(namespace); err != nil {
		return err
	}
	ctx = identity.WithServiceIdentityForSingleNamespaceContext(ctx, namespace)
	return deleteByName(ctx, client, namespace, dashv2beta1.DashboardPreferencesFolderName(folderUID), options)
}
