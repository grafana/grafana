package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	snapshot "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
)

func snapshotAPIEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagSnapshotsKubernetesSnapshots, false, openfeature.TransactionContext(ctx))
}

func (hs *HTTPServer) snapshotClient(c *contextmodel.ReqContext) (rest.Interface, context.Context, string, error) {
	if hs.clientConfigProvider == nil {
		return nil, nil, "", fmt.Errorf("snapshot API is unavailable")
	}
	cfg := hs.clientConfigProvider.GetDirectRestConfig(c)
	if cfg == nil {
		return nil, nil, "", fmt.Errorf("snapshot API is unavailable")
	}
	client, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, nil, "", err
	}
	orgID := c.GetOrgID()
	if orgID < 1 {
		orgID = 1
	}
	namespace := request.GetNamespaceMapper(hs.Cfg)(orgID)
	// Match the ordinary API proxy, including namespace assignment for public reads.
	requester := *c.SignedInUser
	if !c.IsSignedIn {
		requester.OrgID = orgID
		requester.Namespace = namespace
	}
	ctx := identity.WithRequester(c.Req.Context(), &requester)
	return client.RESTClient(), ctx, namespace, nil
}

func snapshotRequest(client rest.Interface, method, namespace string) *rest.Request {
	return client.Verb(method).Prefix("apis", snapshot.GROUP, snapshot.VERSION).Namespace(namespace).Resource("snapshots")
}

// The native API's storage dualwriter resolves migration mode on every operation.
// Calling it also preserves snapshot-specific authorization and external deletion.
func (hs *HTTPServer) getSnapshotFromAPI(c *contextmodel.ReqContext, key string) (*dashboardsnapshots.DashboardSnapshot, error) {
	if hs.Cfg.StackID == "" {
		return nil, apierrors.NewServiceUnavailable("Self-managed public snapshot reads require an indexed public-key lookup")
	}
	client, ctx, namespace, err := hs.snapshotClient(c)
	if err != nil {
		return nil, err
	}
	value, err := snapshotRequest(client, http.MethodGet, namespace).Name(key).Do(ctx).Raw()
	if err != nil {
		return nil, err
	}
	var snap snapshot.Snapshot
	if err := json.Unmarshal(value, &snap); err != nil {
		return nil, err
	}
	value, err = snapshotRequest(client, http.MethodGet, namespace).Name(key).SubResource("dashboard").Do(ctx).Raw()
	if err != nil {
		return nil, err
	}
	var dashboard snapshot.Dashboard
	if err := json.Unmarshal(value, &dashboard); err != nil {
		return nil, err
	}
	result := snapshotDTO(&snap)
	return &dashboardsnapshots.DashboardSnapshot{Name: result.Name, Key: result.Key, Expires: result.Expires, Created: result.Created, Updated: result.Updated, Dashboard: simplejson.NewFromAny(dashboard.Spec.Object)}, nil
}

func snapshotDTO(snap *snapshot.Snapshot) *dashboardsnapshots.DashboardSnapshotDTO {
	created := snap.CreationTimestamp.Time
	updated := snap.GetUpdateTimestamp()
	if updated.IsZero() {
		updated = created
	}
	expires := created.AddDate(50, 0, 0)
	if snap.Spec.Expires != nil && *snap.Spec.Expires > 0 {
		expires = time.UnixMilli(*snap.Spec.Expires)
	}
	out := &dashboardsnapshots.DashboardSnapshotDTO{Key: snap.Name, Created: created, Updated: updated, Expires: expires}
	if snap.Spec.Title != nil {
		out.Name = *snap.Spec.Title
	}
	if snap.Spec.External != nil {
		out.External = *snap.Spec.External
	}
	if snap.Spec.ExternalUrl != nil {
		out.ExternalURL = *snap.Spec.ExternalUrl
	}
	return out
}

func (hs *HTTPServer) searchSnapshotsFromAPI(c *contextmodel.ReqContext, query string, limit int) (dashboardsnapshots.DashboardSnapshotsList, error) {
	client, ctx, namespace, err := hs.snapshotClient(c)
	if err != nil {
		return nil, err
	}
	// Match the legacy store's SQL LIKE query semantics without passing SQL to storage.
	pattern := strings.ReplaceAll(strings.ReplaceAll(regexp.QuoteMeta(query), "%", ".*"), "_", ".")
	matcher, err := regexp.Compile("(?i)^" + pattern + "$")
	if err != nil {
		return nil, err
	}
	result := make(dashboardsnapshots.DashboardSnapshotsList, 0)
	continuation := ""
	pageLimit := limit
	prefixLimit := limit
	prefixFull := false
	for {
		value, err := snapshotRequest(client, http.MethodGet, namespace).Param("limit", fmt.Sprint(pageLimit)).Param("continue", continuation).Do(ctx).Raw()
		if err != nil {
			return nil, err
		}
		var list snapshot.SnapshotList
		if err := json.Unmarshal(value, &list); err != nil {
			return nil, err
		}
		for i := range list.Items {
			dto := snapshotDTO(&list.Items[i])
			if query == "" || matcher.MatchString(dto.Name) {
				result = append(result, dto)
			}
			if len(result) == limit {
				return result, nil
			}
		}
		if list.Continue == "" {
			// Legacy LIST cannot filter by title or continue past its limit. A dual-writer
			// token may come only from unified storage; its next legacy page is empty.
			decoded, err := base64.StdEncoding.DecodeString(continuation)
			unifiedOnly := err == nil && strings.HasPrefix(string(decoded), ",")
			if query != "" && ((continuation == "" && len(list.Items) >= pageLimit) ||
				(unifiedOnly && prefixFull && len(list.Items) == 0)) {
				if prefixLimit > math.MaxInt/2 {
					return nil, fmt.Errorf("snapshot search limit is too large")
				}
				prefixLimit *= 2
				pageLimit = prefixLimit
				continuation = ""
				prefixFull = false
				result = result[:0]
				continue
			}
			return result, nil
		}
		if continuation == "" {
			prefixFull = len(list.Items) >= pageLimit
		}
		if list.Continue == continuation {
			return nil, fmt.Errorf("snapshot pagination did not advance")
		}
		continuation = list.Continue
		pageLimit = limit - len(result)
	}
}

func (hs *HTTPServer) deleteSnapshotFromAPI(c *contextmodel.ReqContext, key string, byDeleteKey bool) response.Response {
	client, ctx, namespace, err := hs.snapshotClient(c)
	if err != nil {
		return snapshotAPIError(err)
	}
	// The compatibility response includes the SQL ID; unified snapshots have no equivalent.
	var legacyID int64
	if !byDeleteKey && hs.dashboardsnapshotsService != nil {
		snap, err := hs.dashboardsnapshotsService.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{Key: key})
		if err == nil && snap != nil {
			legacyID = snap.ID
		}
	}
	req := snapshotRequest(client, http.MethodDelete, namespace)
	if byDeleteKey {
		req = req.Name("delete").SubResource(key)
	} else {
		req = req.Name(key)
	}
	if err := req.Do(ctx).Error(); err != nil {
		return snapshotAPIError(err)
	}
	result := util.DynMap{"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches."}
	if !byDeleteKey {
		result["id"] = legacyID
	}
	return response.JSON(http.StatusOK, result)
}

func snapshotAPIError(err error) response.Response {
	var status apierrors.APIStatus
	if errors.As(err, &status) {
		return response.Error(int(status.Status().Code), status.Status().Message, err)
	}
	return response.Error(http.StatusInternalServerError, "Snapshot request failed", err)
}
