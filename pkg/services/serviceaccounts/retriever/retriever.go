package retriever

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/user"
)

// ServiceAccountRetriever is the service that retrieves service accounts.
// At the time of writing, this service is only used by the service accounts permissions service
// to avoid cyclic dependency between the ServiceAccountService and the ServiceAccountPermissionsService
type ServiceAccountRetriever interface {
	RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error)
}

// ServiceAccountRetriever is the service that manages service accounts.
type Service struct {
	store  *database.ServiceAccountsStoreImpl
	logger log.Logger
}

func ProvideService(
	store db.DB,
	apiKeyService apikey.Service,
	kvStore kvstore.KVStore,
	userService user.Service,
	orgService org.Service,
) *Service {
	serviceAccountsStore := database.ProvideServiceAccountsStore(
		nil,
		store,
		apiKeyService,
		kvStore,
		userService,
		orgService,
	)
	return &Service{
		store:  serviceAccountsStore,
		logger: log.New("serviceaccountretriever"),
	}
}

func (s *Service) RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	return s.store.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
}
