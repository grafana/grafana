package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmiddleware "github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type APIKeyStore interface {
	AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error
	GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error
	DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error
}

type ServiceAccountsAPI struct {
	cfg            *setting.Cfg
	service        serviceaccounts.Service
	accesscontrol  accesscontrol.AccessControl
	RouterRegister routing.RouteRegister
	store          serviceaccounts.Store
	apiKeyStore    APIKeyStore
	log            log.Logger
}

type serviceAccountIdDTO struct {
	Id      int64  `json:"id"`
	Message string `json:"message"`
}

func NewServiceAccountsAPI(
	cfg *setting.Cfg,
	service serviceaccounts.Service,
	accesscontrol accesscontrol.AccessControl,
	routerRegister routing.RouteRegister,
	store serviceaccounts.Store,
	apiKeyStore APIKeyStore,
) *ServiceAccountsAPI {
	return &ServiceAccountsAPI{
		cfg:            cfg,
		service:        service,
		accesscontrol:  accesscontrol,
		RouterRegister: routerRegister,
		store:          store,
		apiKeyStore:    apiKeyStore,
		log:            log.New("serviceaccounts.api"),
	}
}

func (api *ServiceAccountsAPI) RegisterAPIEndpoints(
	features featuremgmt.FeatureToggles,
) {
	if !features.IsEnabled(featuremgmt.FlagServiceAccounts) {
		return
	}

	auth := acmiddleware.Middleware(api.accesscontrol)
	api.RouterRegister.Group("/api/serviceaccounts", func(serviceAccountsRoute routing.RouteRegister) {
		serviceAccountsRoute.Get("/", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionRead, serviceaccounts.ScopeAll)), routing.Wrap(api.ListServiceAccounts))
		serviceAccountsRoute.Post("/", auth(middleware.ReqOrgAdmin,
			accesscontrol.EvalPermission(serviceaccounts.ActionCreate)), routing.Wrap(api.CreateServiceAccount))
		serviceAccountsRoute.Get("/:serviceAccountId", auth(middleware.ReqOrgAdmin,
			accesscontrol.EvalPermission(serviceaccounts.ActionRead, serviceaccounts.ScopeID)), routing.Wrap(api.RetrieveServiceAccount))
		serviceAccountsRoute.Patch("/:serviceAccountId", auth(middleware.ReqOrgAdmin,
			accesscontrol.EvalPermission(serviceaccounts.ActionWrite, serviceaccounts.ScopeID)), routing.Wrap(api.updateServiceAccount))
		serviceAccountsRoute.Delete("/:serviceAccountId", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionDelete, serviceaccounts.ScopeID)), routing.Wrap(api.DeleteServiceAccount))
		serviceAccountsRoute.Post("/upgradeall", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionCreate)), routing.Wrap(api.UpgradeServiceAccounts))
		serviceAccountsRoute.Post("/convert/:keyId", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionCreate, serviceaccounts.ScopeID)), routing.Wrap(api.ConvertToServiceAccount))
		serviceAccountsRoute.Get("/:serviceAccountId/tokens", auth(middleware.ReqOrgAdmin,
			accesscontrol.EvalPermission(serviceaccounts.ActionRead, serviceaccounts.ScopeID)), routing.Wrap(api.ListTokens))
		serviceAccountsRoute.Post("/:serviceAccountId/tokens", auth(middleware.ReqOrgAdmin,
			accesscontrol.EvalPermission(serviceaccounts.ActionWrite, serviceaccounts.ScopeID)), routing.Wrap(api.CreateToken))
		serviceAccountsRoute.Delete("/:serviceAccountId/tokens/:tokenId", auth(middleware.ReqOrgAdmin,
			accesscontrol.EvalPermission(serviceaccounts.ActionWrite, serviceaccounts.ScopeID)), routing.Wrap(api.DeleteToken))
	})
}

// POST /api/serviceaccounts
func (api *ServiceAccountsAPI) CreateServiceAccount(c *models.ReqContext) response.Response {
	cmd := serviceaccounts.CreateServiceAccountForm{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}
	cmd.OrgID = c.OrgId

	user, err := api.service.CreateServiceAccount(c.Req.Context(), &cmd)
	switch {
	case errors.Is(err, serviceaccounts.ErrServiceAccountNotFound):
		return response.Error(http.StatusBadRequest, "Failed to create role with the provided name", err)
	case err != nil:
		return response.Error(http.StatusInternalServerError, "Failed to create service account", err)
	}
	sa := &serviceAccountIdDTO{
		Id:      user.Id,
		Message: "Service account created",
	}
	return response.JSON(http.StatusCreated, sa)
}

func (api *ServiceAccountsAPI) DeleteServiceAccount(ctx *models.ReqContext) response.Response {
	scopeID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}
	err = api.service.DeleteServiceAccount(ctx.Req.Context(), ctx.OrgId, scopeID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Service account deletion error", err)
	}
	return response.Success("service account deleted")
}

func (api *ServiceAccountsAPI) UpgradeServiceAccounts(ctx *models.ReqContext) response.Response {
	if err := api.store.UpgradeServiceAccounts(ctx.Req.Context()); err == nil {
		return response.Success("service accounts upgraded")
	} else {
		return response.Error(http.StatusInternalServerError, "Internal server error", err)
	}
}

func (api *ServiceAccountsAPI) ConvertToServiceAccount(ctx *models.ReqContext) response.Response {
	keyId, err := strconv.ParseInt(web.Params(ctx.Req)[":keyId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "keyId is invalid", err)
	}
	if err := api.store.ConvertToServiceAccounts(ctx.Req.Context(), []int64{keyId}); err == nil {
		return response.Success("service accounts converted")
	} else {
		return response.Error(500, "Internal server error", err)
	}
}

func (api *ServiceAccountsAPI) ListServiceAccounts(c *models.ReqContext) response.Response {
	serviceAccounts, err := api.store.ListServiceAccounts(c.Req.Context(), c.OrgId, -1)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to list service accounts", err)
	}

	saIDs := map[string]bool{}
	for i := range serviceAccounts {
		serviceAccounts[i].AvatarUrl = dtos.GetGravatarUrlWithDefault("", serviceAccounts[i].Name)
		saIDs[strconv.FormatInt(serviceAccounts[i].Id, 10)] = true
	}

	metadata := api.getAccessControlMetadata(c, saIDs)
	if len(metadata) > 0 {
		for i := range serviceAccounts {
			serviceAccounts[i].AccessControl = metadata[strconv.FormatInt(serviceAccounts[i].Id, 10)]
		}
	}

	return response.JSON(http.StatusOK, serviceAccounts)
}

func (api *ServiceAccountsAPI) getAccessControlMetadata(c *models.ReqContext, saIDs map[string]bool) map[string]accesscontrol.Metadata {
	if api.accesscontrol.IsDisabled() || !c.QueryBool("accesscontrol") {
		return map[string]accesscontrol.Metadata{}
	}

	if c.SignedInUser.Permissions == nil {
		return map[string]accesscontrol.Metadata{}
	}

	permissions, ok := c.SignedInUser.Permissions[c.OrgId]
	if !ok {
		return map[string]accesscontrol.Metadata{}
	}

	return accesscontrol.GetResourcesMetadata(c.Req.Context(), permissions, "serviceaccounts", saIDs)
}

func (api *ServiceAccountsAPI) RetrieveServiceAccount(ctx *models.ReqContext) response.Response {
	scopeID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}

	serviceAccount, err := api.store.RetrieveServiceAccount(ctx.Req.Context(), ctx.OrgId, scopeID)
	if err != nil {
		switch {
		case errors.Is(err, serviceaccounts.ErrServiceAccountNotFound):
			return response.Error(http.StatusNotFound, "Failed to retrieve service account", err)
		default:
			return response.Error(http.StatusInternalServerError, "Failed to retrieve service account", err)
		}
	}

	saIDString := strconv.FormatInt(serviceAccount.Id, 10)
	metadata := api.getAccessControlMetadata(ctx, map[string]bool{saIDString: true})
	serviceAccount.AvatarUrl = dtos.GetGravatarUrlWithDefault("", serviceAccount.Name)
	serviceAccount.AccessControl = metadata[saIDString]
	return response.JSON(http.StatusOK, serviceAccount)
}

func (api *ServiceAccountsAPI) updateServiceAccount(c *models.ReqContext) response.Response {
	scopeID, err := strconv.ParseInt(web.Params(c.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}

	cmd := &serviceaccounts.UpdateServiceAccountForm{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if cmd.Role != nil && !cmd.Role.IsValid() {
		return response.Error(http.StatusBadRequest, "Invalid role specified", nil)
	}

	resp, err := api.store.UpdateServiceAccount(c.Req.Context(), c.OrgId, scopeID, cmd)
	if err != nil {
		switch {
		case errors.Is(err, serviceaccounts.ErrServiceAccountNotFound):
			return response.Error(http.StatusNotFound, "Failed to retrieve service account", err)
		default:
			return response.Error(http.StatusInternalServerError, "Failed update service account", err)
		}
	}

	return response.JSON(http.StatusOK, resp)
}
