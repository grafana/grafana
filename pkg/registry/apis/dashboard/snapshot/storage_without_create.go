package snapshot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"
	"k8s.io/klog/v2"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// storageWrapper wraps a rest.Storage and hides the not supported interfaces
// like create, update, and collection delete so the standard K8s endpoints are
// not registered. Snapshot creation is only allowed through the custom
// snapshots/create subresource route.
// It also strips the deleteKey and dashboard from GET/LIST responses so that it is not
// exposed to users with read-only access. The deleteKey is only available
// via the dedicated /snapshots/{name}/deletekey subresource and the dashboard
// via the dedicated /snapshots/{name}/dashboard subresource
type storageWrapper struct {
	inner         rest.Storage
	options       dashv0.SnapshotSharingOptions
	accessControl ac.AccessControl
	blobs         resourcepb.BlobStoreClient
}

var (
	_ rest.Storage              = (*storageWrapper)(nil)
	_ rest.Scoper               = (*storageWrapper)(nil)
	_ rest.SingularNameProvider = (*storageWrapper)(nil)
	_ rest.Getter               = (*storageWrapper)(nil)
	_ rest.Lister               = (*storageWrapper)(nil)
	_ rest.GracefulDeleter      = (*storageWrapper)(nil)
	_ rest.TableConvertor       = (*storageWrapper)(nil)
)

// NewStorageWrapper wraps a storage to hide the rest.Creater interface.
func NewStorageWrapper(s rest.Storage, options dashv0.SnapshotSharingOptions, accessControl ac.AccessControl, blobs resourcepb.BlobStoreClient) rest.Storage {
	return &storageWrapper{inner: s, options: options, accessControl: accessControl, blobs: blobs}
}

func (n *storageWrapper) New() runtime.Object   { return n.inner.New() }
func (n *storageWrapper) Destroy()              { n.inner.Destroy() }
func (n *storageWrapper) NamespaceScoped() bool { return n.inner.(rest.Scoper).NamespaceScoped() }
func (n *storageWrapper) GetSingularName() string {
	return n.inner.(rest.SingularNameProvider).GetSingularName()
}
func (n *storageWrapper) NewList() runtime.Object { return n.inner.(rest.Lister).NewList() }
func (n *storageWrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return n.inner.(rest.TableConvertor).ConvertToTable(ctx, object, tableOptions)
}
func (n *storageWrapper) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj, err := getPublicSnapshot(ctx, n.inner.(rest.Getter), name, options)
	if err != nil {
		return nil, err
	}
	return stripSensitiveFields(obj)
}
func (n *storageWrapper) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	obj, err := n.inner.(rest.Lister).List(ctx, options)
	if err != nil {
		return nil, err
	}
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	list, err := stripSensitiveFieldsFromList(obj)
	if err != nil {
		return nil, err
	}
	if requester.GetOrgRole() != org.RoleAdmin {
		items := make([]dashv0.Snapshot, 0, len(list.Items))
		page := list
		for {
			for _, snap := range page.Items {
				if snapshotOwnedBy(&snap, requester) {
					items = append(items, snap)
				}
			}
			list.Continue = page.Continue
			if options == nil || options.Limit <= 0 || int64(len(items)) >= options.Limit || page.Continue == "" {
				break
			}

			// Consume whole storage pages so the continuation token never skips visible items.
			pageOptions := options.DeepCopy()
			pageOptions.Limit = options.Limit - int64(len(items))
			pageOptions.Continue = page.Continue
			obj, err := n.inner.(rest.Lister).List(ctx, pageOptions)
			if err != nil {
				return nil, err
			}
			page, err = stripSensitiveFieldsFromList(obj)
			if err != nil {
				return nil, err
			}
		}
		list.Items = items
		// Storage pagination counts include snapshots hidden by creator filtering.
		list.RemainingItemCount = nil
	}
	return list, nil
}
func (n *storageWrapper) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// GET the snapshot from inner storage (retains deleteKey, same as the deletekey subresource)
	// to check if it's external and retrieve the deleteKey before deleting.
	lookupCtx, err := snapshotLookupContext(ctx, name)
	if err != nil {
		return nil, false, err
	}
	obj, err := n.inner.(rest.Getter).Get(lookupCtx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, false, fmt.Errorf("expected Snapshot, got %T", obj)
	}

	if err := authorizeSnapshotDelete(ctx, snap, n.accessControl, n.blobs); err != nil {
		return nil, false, err
	}
	if options.Preconditions != nil {
		if uid := options.Preconditions.UID; uid != nil && *uid != snap.UID {
			return nil, false, apierrors.NewConflict(dashv0.SnapshotResourceInfo.GroupResource(), name, fmt.Errorf("UID precondition failed"))
		}
		if rv := options.Preconditions.ResourceVersion; rv != nil && *rv != snap.ResourceVersion {
			return nil, false, apierrors.NewConflict(dashv0.SnapshotResourceInfo.GroupResource(), name, fmt.Errorf("resourceVersion precondition failed"))
		}
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, snap); err != nil {
			return nil, false, err
		}
	}

	// Unified deletion reads the object again internally. Revalidate that object as
	// the caller, while keeping storage reads independent of snapshots:read.
	validate := func(_ context.Context, obj runtime.Object) error {
		current, ok := obj.(*dashv0.Snapshot)
		if !ok {
			return fmt.Errorf("expected Snapshot, got %T", obj)
		}
		if err := authorizeSnapshotDelete(ctx, current, n.accessControl, n.blobs); err != nil {
			return err
		}
		if deleteValidation != nil {
			return deleteValidation(ctx, obj)
		}
		return nil
	}
	// A dry-run must never contact the external host.
	if !dryrun.IsDryRun(options.DryRun) {
		// Delete remotely first so failures retain the local delete key for retries.
		deleteURL, err := deleteSnapshotFromExternalHost(ctx, snap, n.options)
		if err != nil {
			return nil, false, err
		}
		if deleteURL != "" {
			lookupCtx = context.WithValue(lookupCtx, externalSnapshotDeleteURLKey{}, deleteURL)
		}
	}

	result, deleted, err := n.inner.(rest.GracefulDeleter).Delete(lookupCtx, name, validate, options)
	if err != nil {
		return nil, false, err
	}
	return result, deleted, nil
}

type externalSnapshotDeleteURLKey struct{}

func externalSnapshotDeleteEndpoint(externalURL, deleteKey string, kubernetes bool) (string, error) {
	parsed, err := url.Parse(externalURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("invalid external delete URL %q", externalURL)
	}
	legacyPath := "/api/snapshots-delete/"
	kubernetesPath := "/apis/" + dashv0.GROUP + "/" + dashv0.VERSION + "/namespaces/default/" +
		dashv0.SnapshotResourceInfo.GroupResource().Resource + "/delete/"
	targetPath, sourcePath := legacyPath, kubernetesPath
	if kubernetes {
		targetPath, sourcePath = kubernetesPath, legacyPath
	}
	if strings.Contains(parsed.Path, targetPath) {
		return externalURL, nil
	}
	index := strings.LastIndex(parsed.Path, sourcePath)
	if index < 0 {
		// Custom endpoints are authoritative and cannot be translated between API versions.
		return externalURL, nil
	}
	basePath := parsed.Path[:index]
	parsed.Path = strings.TrimRight(basePath, "/") + targetPath + deleteKey
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.ForceQuery = false
	parsed.Fragment = ""
	return parsed.String(), nil
}

func deleteSnapshotFromExternalHost(ctx context.Context, snap *dashv0.Snapshot, options dashv0.SnapshotSharingOptions) (string, error) {
	if snap.Spec.External == nil || !*snap.Spec.External {
		return "", nil
	}
	if snap.Spec.DeleteKey == nil || *snap.Spec.DeleteKey == "" {
		return "", dashboardsnapshots.ErrExternalSnapshotFailed.Errorf("external snapshot delete key is unavailable")
	}
	kubernetesPush := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagExternalSnapshotsK8SAPIPush, false, openfeature.TransactionContext(ctx))
	deleteURL := snap.GetExternalDeleteURL()
	var err error
	if deleteURL != "" {
		deleteURL, err = externalSnapshotDeleteEndpoint(deleteURL, *snap.Spec.DeleteKey, kubernetesPush)
	} else if options.ExternalSnapshotURL != "" {
		deleteURL = strings.TrimRight(options.ExternalSnapshotURL, "/")
		if kubernetesPush {
			deleteURL += "/apis/" + dashv0.GROUP + "/" + dashv0.VERSION + "/namespaces/default/" +
				dashv0.SnapshotResourceInfo.GroupResource().Resource + "/delete/" + *snap.Spec.DeleteKey
		} else {
			deleteURL += "/api/snapshots-delete/" + *snap.Spec.DeleteKey
		}
	} else {
		return "", dashboardsnapshots.ErrExternalSnapshotFailed.Errorf("external snapshot delete URL is unavailable")
	}
	if err != nil {
		return "", err
	}
	if kubernetesPush {
		return deleteURL, deleteExternalSnapshot(deleteURL, options.ExternalSnapshotToken)
	}
	return deleteURL, deleteExternalSnapshotLegacy(deleteURL)
}

// stripSensitiveFields returns a copy of the Snapshot with deleteKey and dashboard removed from the spec.
// It fails closed: a non-Snapshot object (e.g. served by a future default version) returns an error
// rather than leaking the original object with its sensitive fields intact.
func stripSensitiveFields(obj runtime.Object) (*dashv0.Snapshot, error) {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected *%T, got %T", dashv0.Snapshot{}, obj)
	}
	out := snap.DeepCopy()
	out.Spec.DeleteKey = nil
	out.Spec.ExternalDeleteUrl = nil
	out.Spec.Dashboard = nil
	return out, nil
}

// stripSensitiveFieldsFromList returns a copy of the SnapshotList with deleteKey and dashboard
// removed from each item's spec. The dashboard payload can be large and is not needed when listing.
// It fails closed: a non-SnapshotList object (e.g. served by a future default version) returns an
// error rather than leaking the original list with its sensitive fields intact.
func stripSensitiveFieldsFromList(obj runtime.Object) (*dashv0.SnapshotList, error) {
	list, ok := obj.(*dashv0.SnapshotList)
	if !ok {
		return nil, fmt.Errorf("expected *%T, got %T", dashv0.SnapshotList{}, obj)
	}
	out := list.DeepCopy()
	for i := range out.Items {
		out.Items[i].Spec.DeleteKey = nil
		out.Items[i].Spec.ExternalDeleteUrl = nil
		out.Items[i].Spec.Dashboard = nil
	}
	return out, nil
}

var deleteExternalHTTPClient = &http.Client{Timeout: 5 * time.Second}

// deleteExternalSnapshot sends a DELETE request to the external snapshot server's
// delete/{deleteKey} K8s API endpoint to remove the snapshot.
func deleteExternalSnapshot(externalDeleteURL string, token string) error {
	req, err := http.NewRequest(http.MethodDelete, externalDeleteURL, nil)
	if err != nil {
		return err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := deleteExternalHTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to contact external snapshot server: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Treat 404 as success: the snapshot may have already been removed (e.g. by the
	// legacy-store delete path in dualwriter mode 1, which runs before this wrapper).
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotFound {
		return nil
	}

	// Log the response body for debugging
	body, _ := io.ReadAll(resp.Body)
	klog.Errorf("deleteExternalSnapshot failed: status=%d url=%s body=%s", resp.StatusCode, externalDeleteURL, string(body))

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return dashboardsnapshots.ErrExternalSnapshotAuthFailed.Errorf("external snapshot server returned %d on delete", resp.StatusCode)
	}

	return dashboardsnapshots.ErrExternalSnapshotFailed.Errorf("unexpected response when deleting external snapshot, status code: %d", resp.StatusCode)
}

// deleteExternalSnapshotLegacy sends a GET request to the external snapshot
// server's legacy /api/snapshots-delete/{deleteKey} endpoint. If the passed URL
// is in the K8s path format (e.g. a snapshot was created when
// externalSnapshotsK8SAPIPush was on and is now being deleted with it off),
// the host is extracted and the URL is rebuilt in the legacy format.
func deleteExternalSnapshotLegacy(externalURL string) error {
	requestURL := externalURL
	if !strings.Contains(externalURL, "/api/snapshots-delete/") {
		parsed, err := url.Parse(externalURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return fmt.Errorf("invalid external delete URL %q", externalURL)
		}
		deleteKey := path.Base(strings.TrimRight(parsed.Path, "/"))
		if deleteKey == "" || deleteKey == "." || deleteKey == "/" {
			return fmt.Errorf("could not extract delete key from URL %q", externalURL)
		}
		requestURL, err = externalSnapshotDeleteEndpoint(externalURL, deleteKey, false)
		if err != nil {
			return err
		}
	}

	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		return err
	}
	resp, err := deleteExternalHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	// Treat 404 as success — the snapshot may have already been deleted
	// (e.g. double delete, cleanup script). Modern hosts (Grafana >= 9.0) return 404.
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotFound {
		return nil
	}

	// Older hosts (Grafana < 9.0) return 500 with this message when the snapshot is
	// already gone. Treat it as success too so repeat deletes stay idempotent.
	if resp.StatusCode == http.StatusInternalServerError {
		var respJSON map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&respJSON); err != nil {
			return err
		}
		if respJSON["message"] == "Failed to get dashboard snapshot" {
			return nil
		}
	}

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return dashboardsnapshots.ErrExternalSnapshotAuthFailed.Errorf("external snapshot server returned %d on delete", resp.StatusCode)
	}
	return dashboardsnapshots.ErrExternalSnapshotFailed.Errorf("unexpected response when deleting external snapshot, status code: %d", resp.StatusCode)
}
