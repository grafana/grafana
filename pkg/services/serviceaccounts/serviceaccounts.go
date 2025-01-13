package serviceaccounts

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/services/apikey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

/*
ServiceAccountService is the service that manages service accounts.

Service accounts are used to authenticate API requests. They are not users and
do not have a password.
*/

// ServiceAccountRetriever is the service that retrieves service accounts.
// At the time of writing, this service is only used by the service accounts permissions service
// to avoid cyclic dependency between the ServiceAccountService and the ServiceAccountPermissionsService
type ServiceAccountRetriever interface {
	RetrieveServiceAccount(ctx context.Context, query *GetServiceAccountQuery) (*ServiceAccountProfileDTO, error)
}

//go:generate mockery --name Service --structname MockServiceAccountService --output tests --outpkg tests --filename mocks.go
type Service interface {
	ServiceAccountRetriever
	CreateServiceAccount(ctx context.Context, orgID int64, saForm *CreateServiceAccountForm) (*ServiceAccountDTO, error)
	DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error
	RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error)
	SearchOrgServiceAccounts(ctx context.Context, query *SearchOrgServiceAccountsQuery) (*SearchOrgServiceAccountsResult, error)
	EnableServiceAccount(ctx context.Context, orgID, serviceAccountID int64, enable bool) error
	UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64,
		saForm *UpdateServiceAccountForm) (*ServiceAccountProfileDTO, error)

	// Tokens
	AddServiceAccountToken(ctx context.Context, serviceAccountID int64,
		cmd *AddServiceAccountTokenCommand) (*apikey.APIKey, error)
	DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID, tokenID int64) error
	ListTokens(ctx context.Context, query *GetSATokensQuery) ([]apikey.APIKey, error)

	// API specific functions
	MigrateApiKey(ctx context.Context, orgID int64, keyId int64) error
	MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) (*MigrationResult, error)
}

//go:generate mockery --name ExtSvcAccountsService --structname MockExtSvcAccountsService --output tests --outpkg tests --filename extsvcaccmock.go
type ExtSvcAccountsService interface {
	// EnableExtSvcAccount enables or disables the service account associated to an external service
	EnableExtSvcAccount(ctx context.Context, cmd *EnableExtSvcAccountCmd) error
	// ManageExtSvcAccount creates, updates or deletes the service account associated with an external service
	ManageExtSvcAccount(ctx context.Context, cmd *ManageExtSvcAccountCmd) (int64, error)
	// RemoveExtSvcAccount removes the external service account associated with an external service
	RemoveExtSvcAccount(ctx context.Context, orgID int64, extSvcSlug string) error
	// RetrieveExtSvcAccount fetches an external service account by ID
	RetrieveExtSvcAccount(ctx context.Context, orgID, saID int64) (*ExtSvcAccount, error)
}

func UIDToIDHandler(saService ServiceAccountRetriever) func(ctx context.Context, orgID int64, resourceID string) (string, error) {
	return func(ctx context.Context, orgID int64, resourceID string) (string, error) {
		// if saID is empty or is an integer, we assume it's a service account id and we don't need to resolve it
		_, err := strconv.ParseInt(resourceID, 10, 64)
		if resourceID == "" || err == nil {
			return resourceID, nil
		}
		serviceAccount, err := saService.RetrieveServiceAccount(ctx, &GetServiceAccountQuery{
			OrgID: orgID,
			UID:   resourceID,
		})
		if err != nil {
			return "", err
		}
		return strconv.FormatInt(serviceAccount.Id, 10), err
	}
}

func MiddlewareServiceAccountUIDResolver(saService Service, paramName string) web.Handler {
	handler := UIDToIDHandler(saService)

	return func(c *contextmodel.ReqContext) {
		// Get sa id from request, fetch service account and replace saUID with saID
		saUID := web.Params(c.Req)[paramName]
		id, err := handler(c.Req.Context(), c.SignedInUser.GetOrgID(), saUID)
		if err == nil {
			gotParams := web.Params(c.Req)
			gotParams[paramName] = id
			web.SetURLParams(c.Req, gotParams)
		} else {
			c.JsonApiErr(http.StatusNotFound, "Not found", nil)
		}
	}
}
