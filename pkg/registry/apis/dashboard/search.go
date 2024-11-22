package dashboard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// The DTO returns everything the UI needs in a single request
type SearchConnector struct {
	newFunc func() runtime.Object
	client  resource.ResourceIndexClient
	log     log.Logger
}

func NewSearchConnector(
	client resource.ResourceIndexClient,
	newFunc func() runtime.Object,
) (rest.Storage, error) {
	v := &SearchConnector{
		client:  client,
		newFunc: newFunc,
		log:     log.New("grafana-apiserver.dashboards.search"),
	}
	return v, nil
}

var (
	_ rest.Connecter            = (*SearchConnector)(nil)
	_ rest.StorageMetadata      = (*SearchConnector)(nil)
	_ rest.Scoper               = (*SearchConnector)(nil)
	_ rest.SingularNameProvider = (*SearchConnector)(nil)
)

func (r *SearchConnector) New() runtime.Object {
	return r.newFunc()
}

func (r *SearchConnector) Destroy() {
}

func (s *SearchConnector) NamespaceScoped() bool {
	return true // namespace == org
}

func (r *SearchConnector) GetSingularName() string {
	return "Search"
}

func (r *SearchConnector) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *SearchConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *SearchConnector) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *SearchConnector) ProducesObject(verb string) interface{} {
	return r.newFunc()
}

func (r *SearchConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		queryParams, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			responder.Error(err)
			return
		}

		// get limit and offset from query params
		limit := 0
		offset := 0
		if queryParams.Has("limit") {
			limit, _ = strconv.Atoi(queryParams.Get("limit"))
		}
		if queryParams.Has("offset") {
			offset, _ = strconv.Atoi(queryParams.Get("offset"))
		}

		searchRequest := &resource.SearchRequest{
			Tenant:    user.GetNamespace(),
			Kind:      strings.Split(queryParams.Get("kind"), ","),
			QueryType: queryParams.Get("queryType"),
			Query:     queryParams.Get("query"),
			Limit:     int64(limit),
			Offset:    int64(offset),
		}

		// TODO... actually query
		// result, err := r.client.Search(req.Context(), search)
		// if err != nil {
		// 	responder.Error(err)
		// 	return
		// }

		jj, err := json.Marshal(searchRequest)
		if err != nil {
			responder.Error(err)
			return
		}
		_, _ = w.Write(jj)
	}), nil
}
