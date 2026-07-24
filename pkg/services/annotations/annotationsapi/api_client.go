package annotationsapi

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/user"
)

const annotationServerAudience = "annotation.grafana.app"

// annotationClient defines the interface for interacting with the annotation API server.
type annotationClient interface {
	Create(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error)
	Update(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error)
	Delete(ctx context.Context, orgID int64, name string) error
	GetByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*annotationV0.Annotation, error)
	GetUsersFromMeta(ctx context.Context, usersMeta []string) (map[string]*user.User, error)
	Search(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotationV0.Annotation, error)
}

var _ annotationClient = (*annotationAPIClient)(nil)

// TODO: consider replacing k8sClient with a rest.RESTClient built from restCfg for consistency -
// CRUD ops (Create, Update, Delete, also GetByLegacyID) currently go through k8sClient (dynamic),
// while Search uses rest.RESTClient directly.
type annotationAPIClient struct {
	k8sClient client.K8sHandler
	restCfg   *rest.Config

	mu         sync.Mutex
	restClient *rest.RESTClient
}

// newAnnotationAPIClient returns a client for the new annotation API server.
// It returns nil when APIServerURL is empty (proxy disabled).
func newAnnotationAPIClient(cfg *setting.Cfg, userSvc user.Service, exchanger authnlib.TokenExchanger) *annotationAPIClient {
	url := strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL)
	if url == "" {
		return nil
	}

	nsMapper := request.GetNamespaceMapper(cfg)
	restCfg := buildRESTConfig(url, exchanger, nsMapper, cfg.AnnotationAppPlatform.TLSClientConfig)

	return &annotationAPIClient{
		k8sClient: client.NewK8sHandler(
			nsMapper,
			annotationV0.AnnotationKind().GroupVersionResource(),
			func(_ context.Context) (*rest.Config, error) { return restCfg, nil },
			userSvc,
			nil,
		),
		restCfg: restCfg,
	}
}

// ProvideTokenExchanger returns a TokenExchanger for the annotation API server, or nil if the proxy is disabled.
func ProvideTokenExchanger(cfg *setting.Cfg) (authnlib.TokenExchanger, error) {
	if strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL) == "" {
		return nil, nil // proxy disabled
	}

	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := strings.TrimSpace(grpcSection.Key("token").MustString(""))
	tokenExchangeURL := strings.TrimSpace(grpcSection.Key("token_exchange_url").MustString(""))

	if token == "" {
		return nil, fmt.Errorf("annotation proxy: grpc_client_authentication token is required when api_server_url is set")
	}

	if tokenExchangeURL == "" {
		return authnlib.NewStaticTokenExchanger(token), nil
	}

	return newTokenExchangeClient(token, tokenExchangeURL, cfg.Env == setting.Dev)
}

func (s *annotationAPIClient) Create(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	obj, err := toUnstructured(anno)
	if err != nil {
		return nil, err
	}
	result, err := s.k8sClient.Create(ctx, obj, orgID, v1.CreateOptions{})
	if err != nil {
		return nil, err
	}
	return fromUnstructured(result)
}

func (s *annotationAPIClient) Update(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	obj, err := toUnstructured(anno)
	if err != nil {
		return nil, err
	}
	result, err := s.k8sClient.Update(ctx, obj, orgID, v1.UpdateOptions{})
	if err != nil {
		return nil, err
	}
	return fromUnstructured(result)
}

func (s *annotationAPIClient) Delete(ctx context.Context, orgID int64, name string) error {
	return s.k8sClient.Delete(ctx, name, orgID, v1.DeleteOptions{})
}

// GetByLegacyID fetches an annotation by its legacy ID, including the tombstone if it has
// been soft-deleted, so callers can tell a deleted record from a missing one.
//
// TODO: expensive — the legacyID index does not cover the time partition, so this scans
// every partition. Carrying the annotation time to the call sites would let us prune them.
func (s *annotationAPIClient) GetByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*annotationV0.Annotation, error) {
	rc, err := s.getRESTClient()
	if err != nil {
		return nil, err
	}

	namespace := s.k8sClient.GetNamespace(orgID)
	raw, err := rc.Get().
		AbsPath("apis", annotationV0.APIGroup, annotationV0.APIVersion, "namespaces", namespace, "search").
		Param("legacyID", strconv.FormatInt(annotationID, 10)).
		Param("deleted", "include"). // include the tombstone so we can distinguish between deleted and missing
		DoRaw(ctx)
	if err != nil {
		return nil, err
	}

	var list annotationV0.AnnotationList
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("decode search response: %w", err)
	}
	if len(list.Items) == 0 {
		return nil, ErrNotFound
	}

	// Return the newest live annotation, or the tombstone if all are deleted.
	live := slices.DeleteFunc(slices.Clone(list.Items), func(a annotationV0.Annotation) bool {
		return a.GetDeletionTimestamp() != nil
	})
	if len(live) > 0 {
		newest := slices.MaxFunc(live, func(a, b annotationV0.Annotation) int {
			return a.GetCreationTimestamp().Compare(b.GetCreationTimestamp().Time)
		})
		return &newest, nil
	}
	return &list.Items[0], nil
}

func (s *annotationAPIClient) GetUsersFromMeta(ctx context.Context, usersMeta []string) (map[string]*user.User, error) {
	return s.k8sClient.GetUsersFromMeta(ctx, usersMeta)
}

// Search calls the /search custom route, which handles all filtering server-side including tags.
func (s *annotationAPIClient) Search(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotationV0.Annotation, error) {
	rc, err := s.getRESTClient()
	if err != nil {
		return nil, err
	}

	namespace := s.k8sClient.GetNamespace(orgID)
	req := rc.Get().AbsPath("apis", annotationV0.APIGroup, annotationV0.APIVersion, "namespaces", namespace, "search")

	if query.DashboardUID != "" {
		req = req.Param("dashboardUID", query.DashboardUID)
	}
	if query.PanelID != 0 {
		req = req.Param("panelID", strconv.FormatInt(query.PanelID, 10))
	}
	if query.From != 0 {
		req = req.Param("from", strconv.FormatInt(query.From, 10))
	}
	if query.To != 0 {
		req = req.Param("to", strconv.FormatInt(query.To, 10))
	}
	if query.Limit != 0 {
		req = req.Param("limit", strconv.FormatInt(query.Limit, 10))
	}
	for _, tag := range query.Tags {
		req = req.Param("tag", tag)
	}
	if query.MatchAny && len(query.Tags) > 0 {
		req = req.Param("tagsMatchAny", "true")
	}
	if query.UserUID != "" {
		req = req.Param("createdBy", query.UserUID)
	}

	raw, err := req.DoRaw(ctx)
	if err != nil {
		return nil, err
	}

	var list annotationV0.AnnotationList
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("decode search response: %w", err)
	}

	result := make([]*annotationV0.Annotation, len(list.Items))
	for i := range list.Items {
		result[i] = &list.Items[i]
	}
	return result, nil
}

func toUnstructured(anno *annotationV0.Annotation) (*unstructured.Unstructured, error) {
	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(anno)
	if err != nil {
		return nil, fmt.Errorf("annotation to unstructured: %w", err)
	}
	return &unstructured.Unstructured{Object: obj}, nil
}

func fromUnstructured(obj *unstructured.Unstructured) (*annotationV0.Annotation, error) {
	var anno annotationV0.Annotation
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &anno); err != nil {
		return nil, fmt.Errorf("unstructured to annotation: %w", err)
	}
	return &anno, nil
}

// getRESTClient returns a cached REST client for calling custom routes.
// Pattern from pkg/services/user/userk8s: dynamic.ConfigFor sets JSON content negotiation,
// GroupVersion scopes the client to the annotation API group.
func (s *annotationAPIClient) getRESTClient() (*rest.RESTClient, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.restClient != nil {
		return s.restClient, nil
	}
	dynCfg := dynamic.ConfigFor(s.restCfg)
	dynCfg.GroupVersion = &annotationV0.GroupVersion
	rc, err := rest.RESTClientFor(dynCfg)
	if err != nil {
		return nil, fmt.Errorf("create REST client: %w", err)
	}
	s.restClient = rc
	return rc, nil
}

func newTokenExchangeClient(token, tokenExchangeURL string, allowInsecure bool) (authnlib.TokenExchanger, error) {
	var exchangeOpts []authnlib.ExchangeClientOpts
	if allowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(
			&http.Client{Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true, MinVersion: tls.VersionTLS12}, //nolint:gosec
			}},
		))
	}

	tc, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            token,
		TokenExchangeURL: tokenExchangeURL,
	}, exchangeOpts...)
	if err != nil {
		return nil, fmt.Errorf("annotation proxy: creating token exchange client: %w", err)
	}
	return tc, nil
}

func buildRESTConfig(url string, exchanger authnlib.TokenExchanger, nsMapper request.NamespaceMapper, tlsConfig rest.TLSClientConfig) *rest.Config {
	return &rest.Config{
		Host:            url,
		WrapTransport:   newBearerTokenExchangeWrapper(exchanger, nsMapper),
		TLSClientConfig: tlsConfig,
	}
}

type bearerTokenExchangeRT struct {
	exchanger authnlib.TokenExchanger
	nsMapper  request.NamespaceMapper
	next      http.RoundTripper
}

func (rt *bearerTokenExchangeRT) RoundTrip(req *http.Request) (*http.Response, error) {
	ctx := req.Context()
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("resolving requester for token exchange: %w", err)
	}

	resp, err := rt.exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{
		Audiences: []string{annotationServerAudience},
		Namespace: rt.nsMapper(requester.GetOrgID()),
	})
	if err != nil {
		return nil, fmt.Errorf("exchanging token: %w", err)
	}
	req = utilnet.CloneRequest(req)
	req.Header.Set("X-Access-Token", resp.Token)
	return rt.next.RoundTrip(req)
}

func newBearerTokenExchangeWrapper(exchanger authnlib.TokenExchanger, nsMapper request.NamespaceMapper) func(http.RoundTripper) http.RoundTripper {
	return func(rt http.RoundTripper) http.RoundTripper {
		return &bearerTokenExchangeRT{exchanger: exchanger, nsMapper: nsMapper, next: rt}
	}
}
