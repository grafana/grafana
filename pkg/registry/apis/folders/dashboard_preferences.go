package folders

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// deleteFolderDashboardPreferences deletes the folder tier DashboardPreferences of a folder, as the
// service identity of the folder's org. A missing tier counts as deleted.
func deleteFolderDashboardPreferences(ctx context.Context, client dynamic.NamespaceableResourceInterface, namespace, folderUID string, options metav1.DeleteOptions) error {
	ns, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return fmt.Errorf("parse namespace: %w", err)
	}

	name := dashv2beta1.DashboardPreferencesFolderName(folderUID)
	err = client.Namespace(namespace).Delete(identity.WithServiceIdentityContext(ctx, ns.OrgID), name, options)
	if apierrors.IsNotFound(err) {
		// A 404 without a Status body comes from a server that doesn't serve the resource, so a stored object may remain.
		if apierrors.HasStatusCause(err, metav1.CauseTypeUnexpectedServerResponse) {
			logging.FromContext(ctx).Warn("dashboard preferences delete got a not found without a Status body", "namespace", namespace, "name", name)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("delete dashboard preferences %q: %w", name, err)
	}
	return nil
}
