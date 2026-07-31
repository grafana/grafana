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

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/runtime"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/annotations"
)

// annotationClient defines the interface for interacting with the annotation API server.
type annotationClient interface {
	Create(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error)
	Update(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error)
	Delete(ctx context.Context, orgID int64, name string) error
	GetByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*annotationV0.Annotation, error)
	Search(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotationV0.Annotation, error)
	ListTags(ctx context.Context, orgID int64, query *annotations.TagsQuery) ([]annotationV0.GetTagsV0alpha1BodyTags, error)
}

var _ annotationClient = (*annotationAPIClient)(nil)

type annotationAPIClient struct {
	client   *rest.RESTClient
	nsMapper request.NamespaceMapper
}

// newAnnotationAPIClient returns a client for the new annotation API server.
// It returns nil when APIServerURL is empty (proxy disabled).
func newAnnotationAPIClient(cfg *setting.Cfg, exchanger authnlib.TokenExchanger) (*annotationAPIClient, error) {
	url := strings.TrimSpace(cfg.AnnotationAppPlatform.APIServerURL)
	if url == "" {
		return nil, fmt.Errorf("annotation proxy: api_server_url must be set")
	}

	nsMapper := request.GetNamespaceMapper(cfg)
	restCfg := buildRESTConfig(url, exchanger, nsMapper, cfg.AnnotationAppPlatform.TLSClientConfig)

	client, err := rest.RESTClientFor(restCfg)
	if err != nil {
		return nil, fmt.Errorf("annotation proxy: creating REST client: %w", err)
	}

	return &annotationAPIClient{
		client:   client,
		nsMapper: nsMapper,
	}, nil
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
	body, err := json.Marshal(anno)
	if err != nil {
		return nil, fmt.Errorf("encode annotation: %w", err)
	}

	raw, err := s.collection(http.MethodPost, orgID).
		SetHeader("Content-Type", runtime.ContentTypeJSON).
		Body(body).
		DoRaw(ctx)
	if err != nil {
		return nil, err
	}

	return decodeAnnotation(raw)
}

func (s *annotationAPIClient) Update(ctx context.Context, orgID int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	body, err := json.Marshal(anno)
	if err != nil {
		return nil, fmt.Errorf("encode annotation: %w", err)
	}

	raw, err := s.named(http.MethodPut, orgID, anno.GetName()).
		SetHeader("Content-Type", runtime.ContentTypeJSON).
		Body(body).
		DoRaw(ctx)
	if err != nil {
		return nil, err
	}

	return decodeAnnotation(raw)
}

func (s *annotationAPIClient) Delete(ctx context.Context, orgID int64, name string) error {
	return s.named(http.MethodDelete, orgID, name).Do(ctx).Error()
}

// GetByLegacyID fetches an annotation by its legacy ID, including the tombstone if it has
// been soft-deleted, so callers can tell a deleted record from a missing one.
//
// TODO: expensive — the legacyID index does not cover the time partition, so this scans
// every partition. Carrying the annotation time to the call sites would let us prune them.
func (s *annotationAPIClient) GetByLegacyID(ctx context.Context, orgID int64, annotationID int64) (*annotationV0.Annotation, error) {
	req := s.client.Get().
		Namespace(s.nsMapper(orgID)).
		Resource("search").
		Param("legacyID", strconv.FormatInt(annotationID, 10)).
		Param("deleted", "include") // include the tombstone so we can distinguish between deleted and missing

	list, err := doSearch(ctx, req)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, ErrNotFound
	}

	// Return the newest live annotation, or the tombstone if all are deleted.
	live := slices.DeleteFunc(slices.Clone(list), func(a annotationV0.Annotation) bool {
		return a.GetDeletionTimestamp() != nil
	})
	if len(live) > 0 {
		newest := slices.MaxFunc(live, func(a, b annotationV0.Annotation) int {
			return a.GetCreationTimestamp().Compare(b.GetCreationTimestamp().Time)
		})
		return &newest, nil
	}
	return &list[0], nil
}

// Search calls the /search custom route, which handles all filtering server-side including tags.
func (s *annotationAPIClient) Search(ctx context.Context, orgID int64, query *annotations.ItemQuery) ([]*annotationV0.Annotation, error) {
	req := s.client.Get().
		Namespace(s.nsMapper(orgID)).
		Resource("search")

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

	list, err := doSearch(ctx, req)
	if err != nil {
		return nil, err
	}

	result := make([]*annotationV0.Annotation, len(list))
	for i := range list {
		result[i] = &list[i]
	}
	return result, nil
}

// ListTags calls the /tags custom route, which aggregates tag counts across the org.
func (s *annotationAPIClient) ListTags(ctx context.Context, orgID int64, query *annotations.TagsQuery) ([]annotationV0.GetTagsV0alpha1BodyTags, error) {
	req := s.client.Get().
		Namespace(s.nsMapper(orgID)).
		Resource("tags")

	if query.Tag != "" {
		req = req.Param("prefix", query.Tag)
	}
	if query.Limit != 0 {
		req = req.Param("limit", strconv.FormatInt(query.Limit, 10))
	}

	raw, err := req.DoRaw(ctx)
	if err != nil {
		return nil, err
	}

	var body annotationV0.GetTagsBody
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, fmt.Errorf("decode tags response: %w", err)
	}
	return body.Tags, nil
}

// collection builds a request against the namespaced annotations collection for orgID.
func (s *annotationAPIClient) collection(verb string, orgID int64) *rest.Request {
	return s.client.Verb(verb).
		Namespace(s.nsMapper(orgID)).
		Resource(annotationV0.AnnotationKind().Plural())
}

// named builds a request against a single annotation by its resource name.
func (s *annotationAPIClient) named(verb string, orgID int64, name string) *rest.Request {
	return s.collection(verb, orgID).Name(name)
}

// doSearch runs a request against the /search custom route and decodes the matching annotations.
func doSearch(ctx context.Context, req *rest.Request) ([]annotationV0.Annotation, error) {
	raw, err := req.DoRaw(ctx)
	if err != nil {
		return nil, err
	}

	var list annotationV0.AnnotationList
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("decode search response: %w", err)
	}
	return list.Items, nil
}

func decodeAnnotation(raw []byte) (*annotationV0.Annotation, error) {
	var anno annotationV0.Annotation
	if err := json.Unmarshal(raw, &anno); err != nil {
		return nil, fmt.Errorf("decode annotation response: %w", err)
	}
	return &anno, nil
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
	cfg := dynamic.ConfigFor(&rest.Config{
		Host:            url,
		WrapTransport:   newBearerTokenExchangeWrapper(exchanger, nsMapper),
		TLSClientConfig: tlsConfig,
	})
	cfg.APIPath = "apis"
	cfg.GroupVersion = &annotationV0.GroupVersion
	return cfg
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

	namespace := rt.nsMapper(requester.GetOrgID())

	exchangeReq := authnlib.TokenExchangeRequest{
		Audiences: []string{annotationV0.APIGroup},
		Namespace: namespace,
	}

	// Authenticate with OBO, when possible, so the new API properly attributes annotations.
	if requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		exchangeReq.Subject = &authnlib.TokenExchangeSubject{
			Sub:        requester.GetSubject(),
			Identifier: requester.GetIdentifier(),
			Type:       string(requester.GetIdentityType()),
			Namespace:  namespace,
		}
	}

	resp, err := rt.exchanger.Exchange(ctx, exchangeReq)
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
