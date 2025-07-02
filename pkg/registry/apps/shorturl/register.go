package shorturl

import (
	"fmt"
	"net/http"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/gorilla/mux"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/shorturl/pkg/apis"
	shorturlv0alpha1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v0alpha1"
	shorturlapp "github.com/grafana/grafana/apps/shorturl/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type ShortURLAppProvider struct {
	app.Provider
	cfg     *setting.Cfg
	service shorturls.Service
	logger  log.Logger
}

func RegisterApp(
	cfg *setting.Cfg,
	service shorturls.Service,
) *ShortURLAppProvider {
	provider := &ShortURLAppProvider{
		cfg:     cfg,
		service: service,
		logger:  log.New("shorturl::RawHandlers"),
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:    shorturlv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:        shorturlapp.GetKinds(),
		LegacyStorageGetter: provider.legacyStorageGetter,
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, shorturlapp.New)
	return provider
}

// TODO: This is not working yet, as the app registry does not support
func (p *ShortURLAppProvider) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	return &builder.APIRoutes{
		Root: []builder.APIRouteHandler{
			{
				Path: "goto/{uid}",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"ShortURL"},
							Summary:     "Redirect to the original URL",
							Description: "Redirects to the original URL associated with the short URL UID",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "uid",
										In:          "path",
										Required:    true,
										Description: "The unique identifier of the short URL",
										Schema:      spec.StringProperty(),
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										302: {
											ResponseProps: spec3.ResponseProps{
												Description: "Redirect to the original URL",
											},
										},
										307: {
											ResponseProps: spec3.ResponseProps{
												Description: "Temporary redirect on error",
											},
										},
										308: {
											ResponseProps: spec3.ResponseProps{
												Description: "Permanent redirect when not found",
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: p.handleGotoRedirect,
			},
		},
	}
}

func (p *ShortURLAppProvider) legacyStorageGetter(requested schema.GroupVersionResource) grafanarest.Storage {
	gvr := schema.GroupVersionResource{
		Group:    shorturlv0alpha1.ShortURLKind().Group(),
		Version:  shorturlv0alpha1.ShortURLKind().Version(),
		Resource: shorturlv0alpha1.ShortURLKind().Plural(),
	}
	if requested.String() != gvr.String() {
		return nil
	}
	legacyStore := &legacyStorage{
		service:    p.service,
		namespacer: request.GetNamespaceMapper(p.cfg),
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "UID", Type: "string", Format: "string", Description: "The random string identifier"},
				{Name: "Path", Type: "string", Format: "string", Description: "The short url path"},
				{Name: "Last Seen At", Type: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*shorturlv0alpha1.ShortURL)
				if !ok {
					return nil, fmt.Errorf("expected shorturl")
				}
				return []interface{}{
					m.Name,
					m.UID,
					m.Spec.Path,
					m.Spec.LastSeenAt,
				}, nil
			},
		},
	)
	return legacyStore
}

func (p *ShortURLAppProvider) handleGotoRedirect(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	shortURLUID := vars["uid"]

	if !util.IsValidShortUID(shortURLUID) {
		http.Redirect(w, r, p.cfg.AppURL, http.StatusTemporaryRedirect)
		return
	}

	u, err := identity.GetRequester(r.Context())
	userID, _ := identity.UserIdentifier(u.GetUID())

	signedInUser := &user.SignedInUser{
		UserID: userID,
		OrgID:  u.GetOrgID(),
	}

	shortURL, err := p.service.GetShortURLByUID(r.Context(), signedInUser, shortURLUID)
	if err != nil {
		// If we didn't get the URL for whatever reason, we redirect to the
		// main page, otherwise we get into an endless loops of redirects, as
		// we would try to redirect again.
		if shorturls.ErrShortURLNotFound.Is(err) {
			http.Redirect(w, r, p.cfg.AppURL, http.StatusPermanentRedirect)
			return
		}
		http.Redirect(w, r, p.cfg.AppURL, http.StatusTemporaryRedirect)
		return
	}

	// Failure to update LastSeenAt should still allow to redirect
	if err := p.service.UpdateLastSeenAt(r.Context(), shortURL); err != nil {
		p.logger.Error("Failed to update short URL last seen at", "error", err)
	}

	http.Redirect(w, r, setting.ToAbsUrl(shortURL.Path), http.StatusFound)
}
