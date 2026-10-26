package folders

import (
	"context"
	"errors"
	"net/http"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	folderservice "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/federated"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// countedKinds is the explicit "group/resource" list passed to GetStats.
// Without it, the search server enumerates every kind in the namespace first
// (very expensive on KV-backed storage). Each consumer of this stats response
// (e.g. the browse-dashboards UI, validateOnDelete) keeps its own allow-list
// of which of these kinds it actually uses, so adding a kind here does not by
// itself change behavior anywhere else.
var countedKinds = []string{
	"folder.grafana.app/folders",
	"dashboard.grafana.app/dashboards",
	"dashboard.grafana.app/variables",
	"dashboard.grafana.app/librarypanels",
	"rules.alerting.grafana.app/alertrules",
	"rules.alerting.grafana.app/recordingrules",
}

// countStatsErrors resolves the outcome of a GetStats call made by the folder count callers.
//
// raw is the exact failure, for logs and traces. It comes from ErrorFromResponse rather than
// StatusErrorFromResponse because the latter replaces unstructured gRPC 5xx messages with the
// generic status text and would drop a federated.CountError wrapping a gRPC or API status.
//
// public is what the folder API returns: a sanitized 500 from countFailedError, except for
// cancellations and timeouts, which keep their 499/504 status so caller disconnects are not
// reported as server failures.
func countStatsErrors(respErr *resourcepb.ErrorResult, err error, deleting bool) (raw error, public error) {
	raw = resource.ErrorFromResponse(respErr, err)
	if raw == nil {
		return nil, nil
	}
	if isCanceledOrTimedOut(raw) {
		return raw, resource.StatusErrorFromResponse(respErr, err)
	}
	return raw, countFailedError(raw, deleting)
}

func isCanceledOrTimedOut(err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	code := resource.AsErrorResult(err).Code
	return code == errutil.HTTPStatusClientClosedRequest || code == http.StatusGatewayTimeout
}

// countFailedError intentionally maps upstream failures to 500s: the folder API is a server
// client here, so an upstream 4xx describes a server-side dependency failure, not a caller error.
// deleting selects the delete-check message, so a refused delete says why it was refused.
func countFailedError(err error, deleting bool) error {
	var countErr *federated.CountError
	resources := "folder contents"
	if errors.As(err, &countErr) {
		names := make([]string, 0, len(countErr.Resources))
		for _, resource := range countErr.Resources {
			switch resource {
			case "alertrules", "alertrules.rules.alerting.grafana.app":
				names = append(names, "alert rules")
			case "recordingrules", "recordingrules.rules.alerting.grafana.app":
				names = append(names, "recording rules")
			case "library_elements", "librarypanels.dashboard.grafana.app":
				names = append(names, "library panels")
			}
		}
		if len(names) > 0 {
			resources = strings.Join(names, ", ")
		}
	}
	base := folderservice.ErrCountFailed
	if deleting {
		base = folderservice.ErrDeleteCountFailed
	}
	return base.Build(errutil.TemplateData{
		Private: map[string]any{"resources": resources},
		Public:  map[string]any{"resources": resources},
		Error:   err,
	})
}

type subCountREST struct {
	getter   rest.Getter
	searcher resourcepb.ResourceIndexClient
}

var (
	_ rest.Connecter       = (*subCountREST)(nil)
	_ rest.StorageMetadata = (*subCountREST)(nil)
)

func (r *subCountREST) New() runtime.Object {
	return &folders.DescendantCounts{}
}

func (r *subCountREST) Destroy() {
}

func (r *subCountREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subCountREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subCountREST) ProducesObject(verb string) interface{} {
	return &folders.DescendantCounts{}
}

func (r *subCountREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subCountREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ctx, span := tracer.Start(ctx, "folders.subCountREST.Connect")
	_, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		_ = tracing.Error(span, err)
		span.End()
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer span.End()

		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			responder.Error(tracing.Error(span, err))
			return
		}

		stats, err := r.getStats(ctx, ns.Value, name)
		if err != nil {
			responder.Error(tracing.Error(span, err))
			return
		}
		rsp := &folders.DescendantCounts{
			Counts: make([]folders.ResourceStats, len(stats.Stats)),
		}
		for i, v := range stats.Stats {
			rsp.Counts[i] = folders.ResourceStats{
				Group:    v.Group,
				Resource: v.Resource,
				Count:    v.Count,
			}
		}
		responder.Object(200, rsp)
	}), nil
}

// getStats has its own function so the span can be ended with defer and covers only the storage call.
// The exact failure is logged and recorded on the span; the returned error is the public one.
func (r *subCountREST) getStats(ctx context.Context, namespace, name string) (*resourcepb.ResourceStatsResponse, error) {
	ctx, span := tracer.Start(ctx, "folders.subCountREST.getStats")
	defer span.End()

	stats, err := r.searcher.GetStats(ctx, &resourcepb.ResourceStatsRequest{
		Namespace: namespace,
		Kinds:     countedKinds,
		Folder:    []string{name},
	})
	rawErr, publicErr := countStatsErrors(stats.GetError(), err, false)
	if rawErr != nil {
		_ = tracing.Error(span, rawErr)
		logging.FromContext(ctx).Error("Failed to get folder descendant counts", "namespace", namespace, "folder", name, "error", rawErr)
		return nil, publicErr
	}
	return stats, nil
}
