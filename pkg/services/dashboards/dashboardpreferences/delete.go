package dashboardpreferences

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// ErrNotServed is wrapped by a delete that got a 404 which doesn't name the object, as a server that
// doesn't serve dashboardpreferences answers. A stored object may remain.
var ErrNotServed = errors.New("the server does not serve dashboardpreferences")

// IsNotFound reports whether err says that the DashboardPreferences object name doesn't exist. Only a
// NotFound whose Status details name that object counts. A client reports a 404 without a Status body,
// such as one from a route that isn't served, with those same details and an UnexpectedServerResponse
// cause, so that doesn't count.
func IsNotFound(err error, name string) bool {
	if !apierrors.IsNotFound(err) {
		return false
	}
	var status apierrors.APIStatus
	if !errors.As(err, &status) {
		return false
	}
	details := status.Status().Details
	info := dashv2beta1.DashboardPreferencesResourceInfo
	if details == nil || details.Group != info.GroupResource().Group || details.Name != name {
		return false
	}
	if details.Kind != info.GetName() && details.Kind != info.GroupVersionKind().Kind {
		return false
	}
	return !apierrors.HasStatusCause(err, metav1.CauseTypeUnexpectedServerResponse)
}

// deleteByName deletes the DashboardPreferences object name in namespace through client, which must be
// for dashboardpreferences. A missing object is not an error. Any other 404 returns an error that wraps
// ErrNotServed and doesn't read as a NotFound, so that a caller can't take it for a missing object.
func deleteByName(ctx context.Context, client dynamic.NamespaceableResourceInterface, namespace, name string, options metav1.DeleteOptions) error {
	err := client.Namespace(namespace).Delete(ctx, name, options)
	switch {
	case err == nil || IsNotFound(err, name):
		return nil
	case apierrors.IsNotFound(err):
		return fmt.Errorf("delete %s in namespace %s: %w: %v", name, namespace, ErrNotServed, err)
	default:
		return fmt.Errorf("delete %s in namespace %s: %w", name, namespace, err)
	}
}
