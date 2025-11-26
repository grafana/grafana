package teamsearch

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"slices"
	"strconv"

	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	teamsearch "github.com/grafana/grafana/pkg/services/team/search"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

var _ TeamSearchHandler = (*TeamSearchREST)(nil)

type TeamSearchREST struct {
	tracer trace.Tracer
	client resourcepb.ResourceIndexClient
}

func NewTeamSearchREST(tracer trace.Tracer, client resourcepb.ResourceIndexClient) *TeamSearchREST {
	return &TeamSearchREST{tracer: tracer, client: client}
}

func (t *TeamSearchREST) New() runtime.Object {
	return iamv0.NewGetSearch()
}

func (t *TeamSearchREST) Destroy() {
	// no-op
}

func (t *TeamSearchREST) NamespaceScoped() bool {
	return true
}

func (t *TeamSearchREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (t *TeamSearchREST) ProducesObject(verb string) interface{} {
	return t.New()
}

func (t *TeamSearchREST) Connect(ctx context.Context, name string, options runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, span := t.tracer.Start(r.Context(), "team.search")
		defer span.End()

		queryParams, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		limit := 50
		offset := 0
		page := 1
		if queryParams.Has("limit") {
			limit, _ = strconv.Atoi(queryParams.Get("limit"))
		}
		if queryParams.Has("offset") {
			offset, _ = strconv.Atoi(queryParams.Get("offset"))
			if offset > 0 {
				page = (offset / limit) + 1
			}
		} else if queryParams.Has("page") {
			page, _ = strconv.Atoi(queryParams.Get("page"))
			offset = (page - 1) * limit
		}

		searchRequest := &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{},
			Query:   queryParams.Get("query"),
			Limit:   int64(limit),
			Offset:  int64(offset),
			Page:    int64(page),
			Explain: queryParams.Has("explain") && queryParams.Get("explain") != "false",
		}

		fields := []string{"title", "email", "provisioned", "externalUID"}
		if queryParams.Has("field") {
			// add fields to search and exclude duplicates
			for _, f := range queryParams["field"] {
				if f != "" && !slices.Contains(fields, f) {
					fields = append(fields, f)
				}
			}
		}
		searchRequest.Fields = fields

		result, err := t.client.Search(ctx, searchRequest)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		searchResults, err := teamsearch.ParseResults(result, searchRequest.Offset)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		t.write(w, searchResults)
	}), nil
}

func (s *TeamSearchREST) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}

func (t *TeamSearchREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (t *TeamSearchREST) ConnectMethods() []string {
	return []string{"GET"}
}
