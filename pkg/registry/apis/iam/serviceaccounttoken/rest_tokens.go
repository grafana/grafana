package serviceaccounttoken

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	claims "github.com/grafana/authlib/types"
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
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccounttoken/tokenstore"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

const (
	tokensBasePath = "/apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/serviceaccounts/{name}/tokens"
	tokensSubPath  = tokensBasePath + "/{path}"
	appSchemaBase  = "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1."
)

// PostProcessOpenAPI patches the OpenAPI spec for the /tokens endpoints:
//   - Adds request body and response schemas for POST /tokens
//   - Renames {path} to {tokenName} on /tokens/{path}
//   - Removes PUT and PATCH operations
func PostProcessOpenAPI(oas *spec3.OpenAPI) {
	if oas.Paths == nil || oas.Paths.Paths == nil {
		return
	}

	// --- POST /tokens: add request body + response schemas ---
	if p, ok := oas.Paths.Paths[tokensBasePath]; ok && p.Post != nil {
		if oas.Components.Schemas[appSchemaBase+"CreateTokenRequestBody"] == nil {
			oas.Components.Schemas[appSchemaBase+"CreateTokenRequestBody"] = &spec.Schema{
				SchemaProps: spec.SchemaProps{
					Type: []string{"object"},
					Properties: map[string]spec.Schema{
						"title":            *spec.StringProperty(),
						"expiresInSeconds": *spec.Int64Property(),
					},
				},
			}
		}
		if oas.Components.Schemas[appSchemaBase+"CreateTokenBody"] == nil {
			oas.Components.Schemas[appSchemaBase+"CreateTokenBody"] = &spec.Schema{
				SchemaProps: spec.SchemaProps{
					Type: []string{"object"},
					Properties: map[string]spec.Schema{
						"token":                   *spec.StringProperty(),
						"serviceAccountTokenName": *spec.StringProperty(),
						"expires":                 *spec.Int64Property(),
					},
					Required: []string{"token", "serviceAccountTokenName"},
				},
			}
		}

		p.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: spec.RefSchema("#/components/schemas/" + appSchemaBase + "CreateTokenRequestBody"),
						},
					},
				},
			},
		}
		p.Post.Responses.StatusCodeResponses[201] = &spec3.Response{
			ResponseProps: spec3.ResponseProps{
				Description: "Token created",
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: spec.RefSchema("#/components/schemas/" + appSchemaBase + "CreateTokenBody"),
						},
					},
				},
			},
		}

		p.Put = nil
		p.Patch = nil
	}

	// --- /tokens/{path}: rename to /tokens/{tokenName}, remove PUT/PATCH ---
	if p, ok := oas.Paths.Paths[tokensSubPath]; ok {
		for _, v := range p.Parameters {
			if v.Name == "path" {
				v.Name = "tokenName"
				v.Description = "name of the token to operate on"
				break
			}
		}
		p.Put = nil
		p.Patch = nil
		delete(oas.Paths.Paths, tokensSubPath)
		oas.Paths.Paths[tokensBasePath+"/{tokenName}"] = p
	}
}

var (
	_ rest.Storage         = (*TokensREST)(nil)
	_ rest.Scoper          = (*TokensREST)(nil)
	_ rest.StorageMetadata = (*TokensREST)(nil)
	_ rest.Connecter       = (*TokensREST)(nil)
)

// NewTokensREST creates the /tokens subresource handler on ServiceAccount.
//   - saGetter: the registered storage for ServiceAccount (DualWriter or UniStore).
//   - legacyStore: reads/writes tokens in the legacy api_key table.
//   - customStore: writes to the dedicated token DB (Mode5/MT). May be nil.
func NewTokensREST(saGetter rest.Getter, legacyStore legacy.LegacyIdentityStore, customStore tokenstore.TokenSecretStore) *TokensREST {
	return &TokensREST{saGetter: saGetter, legacyStore: legacyStore, customStore: customStore}
}

type TokensREST struct {
	saGetter    rest.Getter                 // reads ServiceAccount from DualWriter / UniStore
	legacyStore legacy.LegacyIdentityStore  // reads/writes tokens in legacy api_key
	customStore tokenstore.TokenSecretStore // writes hash to custom DB; nil in ST/Mode0-1
}

func (s *TokensREST) New() runtime.Object {
	return &iamv0alpha1.ListSATokenResponse{}
}
func (s *TokensREST) Destroy()                               {}
func (s *TokensREST) NamespaceScoped() bool                  { return true }
func (s *TokensREST) ProducesMIMETypes(verb string) []string { return []string{"application/json"} }
func (s *TokensREST) ProducesObject(verb string) any {
	switch verb {
	case "GET":
		return &iamv0alpha1.ListSATokenResponse{}
	case "POST":
		return &iamv0alpha1.CreateSATokenResponse{}
	case "DELETE":
		return &iamv0alpha1.DeleteSATokenResponse{}
	default:
		return &iamv0alpha1.ListSATokenResponse{}
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
		// Verify the ServiceAccount exists.
		obj, err := s.saGetter.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			responder.Error(err)
			return
		}
		if _, ok := obj.(*iamv0alpha1.ServiceAccount); !ok {
			responder.Error(fmt.Errorf("unexpected object type %T", obj))
			return
		}

		// Extract optional tokenName from request info.
		// Parts = ["serviceaccounts", "{saName}", "tokens"] or
		//         ["serviceaccounts", "{saName}", "tokens", "{tokenName}"]
		var tokenName string
		if info, ok := k8srequest.RequestInfoFrom(r.Context()); ok && len(info.Parts) > 3 {
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
	token, err := s.legacyStore.GetServiceAccountToken(ctx, ns, legacy.GetServiceAccountTokenQuery{
		Name:              tokenName,
		ServiceAccountUID: saName,
	})
	if err != nil {
		responder.Error(err)
		return
	}
	if token == nil {
		responder.Error(apierrors.NewNotFound(schema.GroupResource{Group: "iam.grafana.app", Resource: "serviceaccounttokens"}, tokenName))
		return
	}

	resp := &iamv0alpha1.SATokenResponse{
		TokenItem: iamv0alpha1.TokenItem{
			Title:   token.Name,
			Revoked: token.Revoked,
			Expires: token.Expires,
			ServiceAccountRef: iamv0alpha1.ServiceAccountRef{
				Name: saName,
			},
		},
	}
	responder.Object(http.StatusOK, resp)
}

// handleList serves GET /serviceaccounts/{name}/tokens.
func (s *TokensREST) handleList(ctx context.Context, ns claims.NamespaceInfo, saName string, r *http.Request, responder rest.Responder) {
	res, err := s.legacyStore.ListServiceAccountTokens(ctx, ns, legacy.ListServiceAccountTokenQuery{
		UID:        saName,
		Pagination: common.PaginationFromListQuery(r.URL.Query()),
	})
	if err != nil {
		responder.Error(err)
		return
	}

	items := make([]iamv0alpha1.TokenItem, 0, len(res.Items))
	for _, t := range res.Items {
		items = append(items, iamv0alpha1.TokenItem{
			Title:   t.Name,
			Revoked: t.Revoked,
			Expires: t.Expires,
			ServiceAccountRef: iamv0alpha1.ServiceAccountRef{
				Name: saName,
			},
		})
	}

	resp := &iamv0alpha1.ListSATokenResponse{
		ListTokensBody: iamv0alpha1.ListTokensBody{Items: items},
	}
	responder.Object(http.StatusOK, resp)
}

// handleCreate serves POST /serviceaccounts/{name}/tokens.
func (s *TokensREST) handleCreate(ctx context.Context, ns claims.NamespaceInfo, saName string, r *http.Request, responder rest.Responder) {
	var req iamv0alpha1.CreateTokenRequestBody
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			responder.Error(fmt.Errorf("invalid request body: %w", err))
			return
		}
	}

	var title string
	if req.Title != nil {
		title = *req.Title
	}

	var expires *int64
	if req.ExpiresInSeconds != nil && *req.ExpiresInSeconds > 0 {
		exp := time.Now().Unix() + *req.ExpiresInSeconds
		expires = &exp
	}

	// Generate the token ONCE — the same hash goes to both stores.
	keyResult, err := satokengen.New("sa")
	if err != nil {
		responder.Error(fmt.Errorf("failed to generate token: %w", err))
		return
	}

	// --- Write to legacy api_key table (Mode0 / Mode1) ---
	if err := s.legacyStore.SaveServiceAccountTokenHash(ctx, ns, legacy.SaveServiceAccountTokenHashCommand{
		TokenName:         title,
		Title:             title,
		HashedKey:         keyResult.HashedKey,
		ServiceAccountUID: saName,
		Expires:           expires,
	}); err != nil {
		responder.Error(fmt.Errorf("failed to store token (legacy): %w", err))
		return
	}

	// --- Write to custom DB (Mode5 / MT) ---
	// Write also to the custom store if configured in Mode1 and Mode5

	resp := &iamv0alpha1.CreateSATokenResponse{
		CreateTokenBody: iamv0alpha1.CreateTokenBody{
			Token:                   keyResult.ClientSecret,
			ServiceAccountTokenName: title,
			Expires:                 expires,
		},
	}
	responder.Object(http.StatusCreated, resp)
}

// handleDelete serves DELETE /serviceaccounts/{name}/tokens/{tokenName}.
func (s *TokensREST) handleDelete(ctx context.Context, ns claims.NamespaceInfo, saName string, tokenName string, responder rest.Responder) {
	if tokenName == "" {
		responder.Error(fmt.Errorf("tokenName is required for DELETE"))
		return
	}

	// Resolve service account internal ID for the delete command.
	saIDResult, err := s.legacyStore.GetServiceAccountInternalID(ctx, ns, legacy.GetServiceAccountInternalIDQuery{
		OrgID: ns.OrgID,
		UID:   saName,
	})
	if err != nil {
		responder.Error(fmt.Errorf("service account not found: %w", err))
		return
	}

	if err := s.legacyStore.DeleteServiceAccountToken(ctx, ns, legacy.DeleteServiceAccountTokenCommand{
		Name:             tokenName,
		ServiceAccountID: saIDResult.ID,
	}); err != nil {
		responder.Error(fmt.Errorf("failed to delete token: %w", err))
		return
	}

	// --- Delete from custom DB (Mode5 / MT) ---
	if s.customStore != nil {
		if err := s.customStore.Delete(ctx, ns.Value, tokenName); err != nil {
			responder.Error(fmt.Errorf("failed to delete token (custom db): %w", err))
			return
		}
	}

	resp := &iamv0alpha1.DeleteSATokenResponse{
		DeleteTokenBody: iamv0alpha1.DeleteTokenBody{
			Message: fmt.Sprintf("token %q deleted", tokenName),
		},
	}
	responder.Object(http.StatusOK, resp)
}
