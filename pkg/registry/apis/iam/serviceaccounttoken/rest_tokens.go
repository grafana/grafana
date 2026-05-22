package serviceaccounttoken

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"time"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

const (
	tokensBasePath = "/apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/serviceaccounts/{name}/tokens" // #nosec G101 not a credential
	tokensSubPath  = tokensBasePath + "/{path}"
	appSchemaBase  = "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1."

	ServiceID = "sa"

	maxTokenNameLength  = 190
	maxExpiresInSeconds = 157_680_000 // 5 years
)

var (
	// validTokenName allows alphanumerics, hyphens, underscores, and dots.
	// Slashes are forbidden to prevent path-traversal in URL segments.
	validTokenName = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

	saTokenGroupResource = schema.GroupResource{Group: "iam.grafana.app", Resource: "serviceaccounttokens"}
)

var (
	_ rest.Storage         = (*TokensREST)(nil)
	_ rest.Scoper          = (*TokensREST)(nil)
	_ rest.StorageMetadata = (*TokensREST)(nil)
	_ rest.Connecter       = (*TokensREST)(nil)
)

// NewTokensREST creates the /tokens subresource handler on ServiceAccount.
//   - saGetter: the registered storage for ServiceAccount (DualWriter or UniStore).
//   - legacyStore: reads/writes tokens in the legacy api_key table.
func NewTokensREST(saGetter rest.Getter, legacyStore legacy.LegacyIdentityStore, tracer trace.Tracer) *TokensREST {
	return &TokensREST{
		saGetter:    saGetter,
		legacyStore: legacyStore,
		logger:      log.New("grafana-apiserver.serviceaccounttokens.api"),
		tracer:      tracer,
	}
}

type TokensREST struct {
	logger      log.Logger
	tracer      trace.Tracer
	saGetter    rest.Getter                // reads ServiceAccount from DualWriter / UniStore
	legacyStore legacy.LegacyIdentityStore // reads/writes tokens in legacy api_key
}

func (s *TokensREST) New() runtime.Object {
	return &iamv0alpha1.ListServiceAccountTokensResponse{}
}
func (s *TokensREST) Destroy()                               {}
func (s *TokensREST) NamespaceScoped() bool                  { return true }
func (s *TokensREST) ProducesMIMETypes(verb string) []string { return []string{"application/json"} }
func (s *TokensREST) ProducesObject(verb string) any {
	switch verb {
	case "GET":
		return &iamv0alpha1.ListServiceAccountTokensResponse{}
	case "POST":
		return &iamv0alpha1.CreateServiceAccountTokenResponse{}
	case "DELETE":
		return &iamv0alpha1.DeleteServiceAccountTokenResponse{}
	default:
		return &iamv0alpha1.ListServiceAccountTokensResponse{}
	}
}
func (s *TokensREST) ConnectMethods() []string {
	return []string{http.MethodGet, http.MethodPost, http.MethodDelete}
}

// NewConnectOptions returns (nil, true, "") — true enables the trailing subpath
// so DELETE /tokens/{tokenName} receives tokenName via the request URL.
func (s *TokensREST) NewConnectOptions() (runtime.Object, bool, string) { return nil, true, "" }

// Connect implements rest.Connecter.
//
//	GET    /serviceaccounts/{name}/tokens              — list tokens
//	GET    /serviceaccounts/{name}/tokens/{tokenName}  — get a single token
//	POST   /serviceaccounts/{name}/tokens              — create token, return plaintext once
//	DELETE /serviceaccounts/{name}/tokens/{tokenName}  — delete a token
func (s *TokensREST) Connect(ctx context.Context, name string, options runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// NOTE: We use the outer ctx (from Connect) for store operations because
		// the k8s apiserver decorates it with namespace/auth info. r.Context()
		// is only used to extract request-level info (Parts).

		// Verify the ServiceAccount exists.
		obj, err := s.saGetter.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			responder.Error(err)
			return
		}
		if _, ok := obj.(*iamv0alpha1.ServiceAccount); !ok {
			responder.Error(apierrors.NewInternalError(fmt.Errorf("unexpected object type %T", obj)))
			return
		}

		// Extract optional tokenName from request info.
		// Parts = ["serviceaccounts", "{saName}", "tokens"] or
		//         ["serviceaccounts", "{saName}", "tokens", "{tokenName}"]
		var tokenName string
		if info, ok := k8srequest.RequestInfoFrom(r.Context()); ok && len(info.Parts) > 3 && info.Parts[2] == "tokens" {
			tokenName = info.Parts[3]
		}

		switch r.Method {
		case http.MethodGet:
			if tokenName != "" {
				s.handleGet(ctx, ns, name, tokenName, responder)
			} else {
				s.handleList(ctx, ns, name, r, responder)
			}
		case http.MethodPost:
			s.handleCreate(ctx, ns, name, r, responder)
		case http.MethodDelete:
			s.handleDelete(ctx, ns, name, tokenName, responder)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}), nil
}

// handleGet serves GET /serviceaccounts/{name}/tokens/{tokenName}.
func (s *TokensREST) handleGet(ctx context.Context, ns claims.NamespaceInfo, saName string, tokenName string, responder rest.Responder) {
	ctx, span := s.tracer.Start(ctx, "serviceaccounttoken.api.get")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	token, err := s.legacyStore.GetServiceAccountToken(ctx, ns, legacy.GetServiceAccountTokenQuery{
		Name:              tokenName,
		ServiceAccountUID: saName,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get token")
		ctxLogger.Error("failed to get service account token", "error", err, "tokenName", tokenName, "serviceAccount", saName)
		responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to get token: %w", err)))
		return
	}
	if token == nil {
		responder.Error(apierrors.NewNotFound(saTokenGroupResource, tokenName))
		return
	}

	resp := &iamv0alpha1.GetServiceAccountTokenResponse{
		GetServiceAccountTokenBody: iamv0alpha1.GetServiceAccountTokenBody{
			Body: mapGetToken(*token),
		},
	}
	responder.Object(http.StatusOK, resp)
}

// handleList serves GET /serviceaccounts/{name}/tokens.
func (s *TokensREST) handleList(ctx context.Context, ns claims.NamespaceInfo, saName string, r *http.Request, responder rest.Responder) {
	ctx, span := s.tracer.Start(ctx, "serviceaccounttoken.api.list")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	res, err := s.legacyStore.ListServiceAccountTokens(ctx, ns, legacy.ListServiceAccountTokenQuery{
		UID:        saName,
		Pagination: common.PaginationFromListQuery(r.URL.Query()),
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to list tokens")
		ctxLogger.Error("failed to list service account tokens", "error", err, "serviceAccount", saName)
		responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to list tokens: %w", err)))
		return
	}

	items := make([]iamv0alpha1.ListServiceAccountTokensToken, 0, len(res.Items))
	for _, t := range res.Items {
		items = append(items, mapListToken(t))
	}

	resp := &iamv0alpha1.ListServiceAccountTokensResponse{
		ListServiceAccountTokensBody: iamv0alpha1.ListServiceAccountTokensBody{
			Items:    items,
			Continue: common.OptionalFormatInt(res.Continue),
		},
	}
	responder.Object(http.StatusOK, resp)
}

// handleCreate serves POST /serviceaccounts/{name}/tokens.
func (s *TokensREST) handleCreate(ctx context.Context, ns claims.NamespaceInfo, saName string, r *http.Request, responder rest.Responder) {
	ctx, span := s.tracer.Start(ctx, "serviceaccounttoken.api.create")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	var req iamv0alpha1.CreateServiceAccountTokenRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		responder.Error(apierrors.NewBadRequest(fmt.Sprintf("invalid request body: %v", err)))
		return
	}

	if req.TokenName == "" {
		responder.Error(apierrors.NewBadRequest("tokenName is required"))
		return
	}
	if len(req.TokenName) > maxTokenNameLength {
		responder.Error(apierrors.NewBadRequest(fmt.Sprintf("tokenName must be at most %d characters", maxTokenNameLength)))
		return
	}
	if !validTokenName.MatchString(req.TokenName) {
		responder.Error(apierrors.NewBadRequest("tokenName may only contain alphanumerics, hyphens, underscores, and dots"))
		return
	}
	if req.ExpiresInSeconds < 0 {
		responder.Error(apierrors.NewBadRequest("expiresInSeconds must not be negative"))
		return
	}
	if req.ExpiresInSeconds > maxExpiresInSeconds {
		responder.Error(apierrors.NewBadRequest(fmt.Sprintf("expiresInSeconds must not exceed %d (5 years)", maxExpiresInSeconds)))
		return
	}

	// 0 means "never expires" — only compute an absolute timestamp when positive.
	var expires int64
	if req.ExpiresInSeconds > 0 {
		expires = time.Now().Unix() + req.ExpiresInSeconds
	}

	// Generate the token ONCE — the same hash goes to both stores.
	keyResult, err := satokengen.New(ServiceID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to generate token")
		ctxLogger.Error("failed to generate service account token", "error", err, "serviceAccount", saName)
		responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to generate token: %w", err)))
		return
	}

	// --- Write to legacy api_key table (Mode0 / Mode1) ---
	cmd := legacy.CreateServiceAccountTokenWithHashCommand{
		TokenName:         req.TokenName,
		HashedKey:         keyResult.HashedKey,
		ServiceAccountUID: saName,
	}
	if expires > 0 {
		cmd.Expires = &expires
	}
	if err := s.legacyStore.CreateServiceAccountTokenWithHash(ctx, ns, cmd); err != nil {
		if errors.Is(err, legacy.ErrTokenAlreadyExists) {
			responder.Error(apierrors.NewConflict(
				saTokenGroupResource,
				req.TokenName,
				err,
			))
			return
		}
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to store token")
		ctxLogger.Error("failed to store service account token", "error", err, "tokenName", req.TokenName, "serviceAccount", saName)
		responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to store token (legacy): %w", err)))
		return
	}

	// TODO: Write to custom token store when configured (Mode5 / MT).

	resp := &iamv0alpha1.CreateServiceAccountTokenResponse{
		CreateServiceAccountTokenBody: iamv0alpha1.CreateServiceAccountTokenBody{
			Token:                   keyResult.ClientSecret,
			ServiceAccountTokenName: req.TokenName,
			Expires:                 expires,
		},
	}
	responder.Object(http.StatusCreated, resp)
}

// handleDelete serves DELETE /serviceaccounts/{name}/tokens/{tokenName}.
func (s *TokensREST) handleDelete(ctx context.Context, ns claims.NamespaceInfo, saName string, tokenName string, responder rest.Responder) {
	ctx, span := s.tracer.Start(ctx, "serviceaccounttoken.api.delete")
	defer span.End()
	ctxLogger := s.logger.FromContext(ctx)

	if tokenName == "" {
		responder.Error(apierrors.NewBadRequest("tokenName is required for DELETE"))
		return
	}

	// Resolve service account internal ID for the delete command.
	saIDResult, err := s.legacyStore.GetServiceAccountInternalID(ctx, ns, legacy.GetServiceAccountInternalIDQuery{
		OrgID: ns.OrgID,
		UID:   saName,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to resolve service account ID")
		ctxLogger.Error("failed to get service account internal ID", "error", err, "serviceAccount", saName)
		responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to get service account internal ID: %w", err)))
		return
	}

	if saIDResult == nil {
		responder.Error(apierrors.NewNotFound(schema.GroupResource{Group: "iam.grafana.app", Resource: "serviceaccounts"}, saName))
		return
	}

	rowsAffected, err := s.legacyStore.DeleteServiceAccountToken(ctx, ns, legacy.DeleteServiceAccountTokenCommand{
		Name:             tokenName,
		ServiceAccountID: saIDResult.ID,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to delete token")
		ctxLogger.Error("failed to delete service account token", "error", err, "tokenName", tokenName, "serviceAccount", saName)
		responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to delete token: %w", err)))
		return
	}
	if rowsAffected == 0 {
		responder.Error(apierrors.NewNotFound(saTokenGroupResource, tokenName))
		return
	}

	// TODO: Delete from custom token store when configured (Mode5 / MT).

	resp := &iamv0alpha1.DeleteServiceAccountTokenResponse{
		DeleteServiceAccountTokenBody: iamv0alpha1.DeleteServiceAccountTokenBody{
			Message: fmt.Sprintf("token %q deleted", tokenName),
		},
	}
	responder.Object(http.StatusOK, resp)
}

func mapListToken(t legacy.ServiceAccountToken) iamv0alpha1.ListServiceAccountTokensToken {
	item := iamv0alpha1.ListServiceAccountTokensToken{
		Title:   t.Name,
		Revoked: t.Revoked,
		Created: t.Created.Unix(),
		Updated: t.Updated.Unix(),
	}
	if t.Expires != nil {
		item.Expires = *t.Expires
	}
	if t.LastUsed != nil {
		item.LastUsed = t.LastUsed.Unix()
	}
	return item
}

func mapGetToken(t legacy.ServiceAccountToken) iamv0alpha1.GetServiceAccountTokenToken {
	return iamv0alpha1.GetServiceAccountTokenToken(mapListToken(t))
}

// PostProcessOpenAPI patches the OpenAPI spec for the /tokens subresource paths:
//   - Registers the POST request body schema (not emitted by openapi-gen)
//   - Fixes 200 response schemas on GET (k8s defaults to TypeMeta)
//   - Wires request body and 201 response for POST /tokens
//   - Adds limit/continue query params on GET /tokens
//   - Renames {path} to {tokenName} on /tokens/{path}
//   - Removes DELETE, PUT, and PATCH from the collection path
//     (DELETE only applies to /tokens/{tokenName})
//
// Response schemas are registered automatically by the generated openapi
// (zz_openapi_gen.go); only the request body is registered manually because
// it isn't tagged with +k8s:openapi-gen=true.
func PostProcessOpenAPI(oas *spec3.OpenAPI) {
	if oas.Paths == nil || oas.Paths.Paths == nil {
		return
	}

	ensureComponentSchemas(oas)

	jsonResponse := func(schemaName string, description string) *spec3.Response {
		return &spec3.Response{
			ResponseProps: spec3.ResponseProps{
				Description: description,
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: spec.RefSchema("#/components/schemas/" + appSchemaBase + schemaName),
						},
					},
				},
			},
		}
	}

	// --- /tokens: fix GET/POST schemas, add list query params, remove DELETE/PUT/PATCH ---
	if p, ok := oas.Paths.Paths[tokensBasePath]; ok {
		if p.Get != nil {
			p.Get.Responses.StatusCodeResponses[200] = jsonResponse("ListServiceAccountTokensBody", "OK")
			p.Get.Parameters = append(p.Get.Parameters,
				&spec3.Parameter{
					ParameterProps: spec3.ParameterProps{
						Name:        "limit",
						In:          "query",
						Description: "maximum number of tokens to return in a single page",
						Schema:      spec.Int64Property(),
					},
				},
				&spec3.Parameter{
					ParameterProps: spec3.ParameterProps{
						Name:        "continue",
						In:          "query",
						Description: "continue token returned by a previous list response to fetch the next page",
						Schema:      spec.StringProperty(),
					},
				},
			)
		}

		if p.Post != nil {
			p.Post.RequestBody = &spec3.RequestBody{
				RequestBodyProps: spec3.RequestBodyProps{
					Content: map[string]*spec3.MediaType{
						"application/json": {
							MediaTypeProps: spec3.MediaTypeProps{
								Schema: spec.RefSchema("#/components/schemas/" + appSchemaBase + "CreateServiceAccountTokenRequestBody"),
							},
						},
					},
				},
			}
			delete(p.Post.Responses.StatusCodeResponses, 200)
			p.Post.Responses.StatusCodeResponses[201] = jsonResponse("CreateServiceAccountTokenBody", "Token created")
		}

		p.Delete = nil
		p.Put = nil
		p.Patch = nil

		fixNameParam(p)
	}

	// --- /tokens/{path}: fix response schemas, rename to {tokenName}, remove PUT/PATCH ---
	if p, ok := oas.Paths.Paths[tokensSubPath]; ok {
		for _, v := range p.Parameters {
			if v.Name == "path" {
				v.Name = "tokenName"
				v.Description = "name of the token to operate on"
				break
			}
		}

		if p.Get != nil {
			p.Get.Responses.StatusCodeResponses[200] = jsonResponse("GetServiceAccountTokenBody", "OK")
		}
		if p.Delete != nil {
			p.Delete.Responses.StatusCodeResponses[200] = jsonResponse("DeleteServiceAccountTokenBody", "OK")
		}

		p.Post = nil
		p.Put = nil
		p.Patch = nil

		fixNameParam(p)

		delete(oas.Paths.Paths, tokensSubPath)
		oas.Paths.Paths[tokensBasePath+"/{tokenName}"] = p
	}
}

// fixNameParam corrects the "name" parameter description from the k8s-generated
// "name of the ListServiceAccountTokensResponse" to "name of the ServiceAccount".
func fixNameParam(p *spec3.Path) {
	for _, v := range p.Parameters {
		if v.Name == "name" {
			v.Description = "name of the ServiceAccount"
			break
		}
	}
}

// ensureComponentSchemas registers schemas that aren't emitted by openapi-gen.
// The generated request body type has no +k8s:openapi-gen=true marker, so we
// have to hand-register it to avoid "MissingPointerError" for $ref lookups.
func ensureComponentSchemas(oas *spec3.OpenAPI) {
	if oas.Components == nil {
		oas.Components = &spec3.Components{}
	}
	if oas.Components.Schemas == nil {
		oas.Components.Schemas = map[string]*spec.Schema{}
	}

	key := appSchemaBase + "CreateServiceAccountTokenRequestBody"
	if oas.Components.Schemas[key] != nil {
		return
	}
	oas.Components.Schemas[key] = &spec.Schema{
		SchemaProps: spec.SchemaProps{
			Type: []string{"object"},
			Properties: map[string]spec.Schema{
				"tokenName":        *spec.StringProperty(),
				"expiresInSeconds": *spec.Int64Property(),
			},
			Required: []string{"tokenName"},
		},
	}
}
