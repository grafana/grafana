package manager

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/secretscan"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	metricsCollectionInterval = time.Minute * 30
	defaultSecretScanInterval = time.Minute * 5
)

type ServiceAccountsService struct {
	store             store
	log               log.Logger
	backgroundLog     log.Logger
	secretScanService secretscan.Checker

	secretScanEnabled  bool
	secretScanInterval time.Duration
}

func ProvideServiceAccountsService(
	cfg *setting.Cfg,
	ac accesscontrol.AccessControl,
	routeRegister routing.RouteRegister,
	usageStats usagestats.Service,
	store *sqlstore.SQLStore,
	apiKeyService apikey.Service,
	kvStore kvstore.KVStore,
	userService user.Service,
	orgService org.Service,
	permissionService accesscontrol.ServiceAccountPermissionsService,
	accesscontrolService accesscontrol.Service,
) (*ServiceAccountsService, error) {
	serviceAccountsStore := database.ProvideServiceAccountsStore(
		cfg,
		store,
		apiKeyService,
		kvStore,
		userService,
		orgService,
	)
	log := log.New("serviceaccounts")
	s := &ServiceAccountsService{
		store:         serviceAccountsStore,
		log:           log,
		backgroundLog: log.New("serviceaccounts.background"),
	}

	if err := RegisterRoles(accesscontrolService); err != nil {
		s.log.Error("Failed to register roles", "error", err)
	}

	usageStats.RegisterMetricsFunc(s.getUsageMetrics)

	serviceaccountsAPI := api.NewServiceAccountsAPI(cfg, s, ac, accesscontrolService, routeRegister, permissionService)
	serviceaccountsAPI.RegisterAPIEndpoints()

	s.secretScanEnabled = cfg.SectionWithEnvOverrides("secretscan").Key("enabled").MustBool(false)
	s.secretScanInterval = cfg.SectionWithEnvOverrides("secretscan").
		Key("interval").MustDuration(defaultSecretScanInterval)
	if s.secretScanEnabled {
		var errSecret error
		s.secretScanService, errSecret = secretscan.NewService(s.store, cfg)
		if errSecret != nil {
			s.secretScanEnabled = false
			s.log.Warn("failed to initialize secret scan service. secret scan is disabled",
				"error", errSecret.Error())
		}
	}

	return s, nil
}

func (sa *ServiceAccountsService) Run(ctx context.Context) error {
	sa.backgroundLog.Debug("service initialized")

	if _, err := sa.getUsageMetrics(ctx); err != nil {
		sa.log.Warn("Failed to get usage metrics", "error", err.Error())
	}

	updateStatsTicker := time.NewTicker(metricsCollectionInterval)
	defer updateStatsTicker.Stop()

	// Enforce a minimum interval of 1 minute.
	if sa.secretScanEnabled && sa.secretScanInterval < time.Minute {
		sa.backgroundLog.Warn("secret scan interval is too low, increasing to " +
			defaultSecretScanInterval.String())

		sa.secretScanInterval = defaultSecretScanInterval
	}

	tokenCheckTicker := time.NewTicker(sa.secretScanInterval)

	if !sa.secretScanEnabled {
		tokenCheckTicker.Stop()
	} else {
		sa.backgroundLog.Debug("enabled token secret check and executing first check")
		if err := sa.secretScanService.CheckTokens(ctx); err != nil {
			sa.backgroundLog.Warn("Failed to check for leaked tokens", "error", err.Error())
		}

		defer tokenCheckTicker.Stop()
	}

	for {
		select {
		case <-ctx.Done():
			if err := ctx.Err(); err != nil {
				return fmt.Errorf("context error in service account background service: %w", ctx.Err())
			}

			sa.backgroundLog.Debug("stopped service account background service")

			return nil
		case <-updateStatsTicker.C:
			sa.backgroundLog.Debug("updating usage metrics")

			if _, err := sa.getUsageMetrics(ctx); err != nil {
				sa.backgroundLog.Warn("Failed to get usage metrics", "error", err.Error())
			}
		case <-tokenCheckTicker.C:
			sa.backgroundLog.Debug("checking for leaked tokens")

			if err := sa.secretScanService.CheckTokens(ctx); err != nil {
				sa.backgroundLog.Warn("Failed to check for leaked tokens", "error", err.Error())
			}
		}
	}
}

func (sa *ServiceAccountsService) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	if err := validOrgID(orgID); err != nil {
		return nil, err
	}
	return sa.store.CreateServiceAccount(ctx, orgID, saForm)
}

func (sa *ServiceAccountsService) RetrieveServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	if err := validOrgID(orgID); err != nil {
		return nil, err
	}
	if err := validServiceAccountID(serviceAccountID); err != nil {
		return nil, err
	}
	return sa.store.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
}

func (sa *ServiceAccountsService) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	if err := validOrgID(orgID); err != nil {
		return 0, err
	}
	if name == "" {
		return 0, errors.New("name is required")
	}
	return sa.store.RetrieveServiceAccountIdByName(ctx, orgID, name)
}

func (sa *ServiceAccountsService) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	if err := validOrgID(orgID); err != nil {
		return err
	}
	if err := validServiceAccountID(serviceAccountID); err != nil {
		return err
	}
	return sa.store.DeleteServiceAccount(ctx, orgID, serviceAccountID)
}

func (sa *ServiceAccountsService) UpdateServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64, saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	if err := validOrgID(orgID); err != nil {
		return nil, err
	}
	if err := validServiceAccountID(serviceAccountID); err != nil {
		return nil, err
	}
	return sa.store.UpdateServiceAccount(ctx, orgID, serviceAccountID, saForm)
}

func (sa *ServiceAccountsService) SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error) {
	if query.Page <= 0 || query.Limit <= 0 {
		query.SetDefaults()
		// optional: logging
	}
	return sa.store.SearchOrgServiceAccounts(ctx, query)
}

func (sa *ServiceAccountsService) ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error) {
	return sa.store.ListTokens(ctx, query)
}

func (sa *ServiceAccountsService) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, query *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	if err := validServiceAccountID(serviceAccountID); err != nil {
		return nil, err
	}
	return sa.store.AddServiceAccountToken(ctx, serviceAccountID, query)
}

func (sa *ServiceAccountsService) DeleteServiceAccountToken(ctx context.Context, orgID, serviceAccountID int64, tokenID int64) error {
	if err := validOrgID(orgID); err != nil {
		return err
	}
	if err := validServiceAccountID(serviceAccountID); err != nil {
		return err
	}
	if err := validServiceAccountTokenID(tokenID); err != nil {
		return err
	}
	return sa.store.DeleteServiceAccountToken(ctx, orgID, serviceAccountID, tokenID)
}

func (sa *ServiceAccountsService) MigrateApiKey(ctx context.Context, orgID, keyID int64) error {
	if err := validOrgID(orgID); err != nil {
		return err
	}
	if err := validAPIKeyID(keyID); err != nil {
		return err
	}
	return sa.store.MigrateApiKey(ctx, orgID, keyID)
}
func (sa *ServiceAccountsService) MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) error {
	if err := validOrgID(orgID); err != nil {
		return err
	}
	return sa.store.MigrateApiKeysToServiceAccounts(ctx, orgID)
}

func validOrgID(orgID int64) error {
	if orgID == 0 {
		return serviceaccounts.ErrServiceAccountInvalidOrgID.Errorf("invalid org ID 0 has been specified")
	}
	return nil
}
func validServiceAccountID(serviceaccountID int64) error {
	if serviceaccountID == 0 {
		return serviceaccounts.ErrServiceAccountInvalidID.Errorf("invalid service account ID 0 has been specified")
	}
	return nil
}
func validServiceAccountTokenID(tokenID int64) error {
	if tokenID == 0 {
		return serviceaccounts.ErrServiceAccountInvalidTokenID.Errorf("invalid service account token ID 0 has been specified")
	}
	return nil
}
func validAPIKeyID(apiKeyID int64) error {
	if apiKeyID == 0 {
		return serviceaccounts.ErrServiceAccountInvalidAPIKeyID.Errorf("invalid API key ID 0 has been specified")
	}
	return nil
}
