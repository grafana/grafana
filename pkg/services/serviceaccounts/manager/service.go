package manager

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/secretscan"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	metricsCollectionInterval = time.Minute * 30
	defaultSecretScanInterval = time.Minute * 5
)

type ServiceAccountsService struct {
	acService   accesscontrol.Service
	permissions accesscontrol.ServiceAccountPermissionsService

	cfg               *setting.Cfg
	db                db.DB
	store             store
	log               log.Logger
	backgroundLog     log.Logger
	secretScanService secretscan.Checker

	secretScanEnabled  bool
	secretScanInterval time.Duration
}

func ProvideServiceAccountsService(
	cfg *setting.Cfg,
	usageStats usagestats.Service,
	store db.DB,
	apiKeyService apikey.Service,
	kvStore kvstore.KVStore,
	userService user.Service,
	orgService org.Service,
	acService accesscontrol.Service,
	permissions accesscontrol.ServiceAccountPermissionsService,
) (*ServiceAccountsService, error) {
	serviceAccountsStore := database.ProvideServiceAccountsStore(
		cfg,
		store,
		apiKeyService,
		kvStore,
		userService,
		orgService,
	)
	s := &ServiceAccountsService{
		cfg:           cfg,
		db:            store,
		acService:     acService,
		permissions:   permissions,
		store:         serviceAccountsStore,
		log:           log.New("serviceaccounts"),
		backgroundLog: log.New("serviceaccounts.background"),
	}

	if err := RegisterRoles(acService); err != nil {
		s.log.Error("Failed to register roles", "error", err)
	}

	usageStats.RegisterMetricsFunc(s.getUsageMetrics)

	s.secretScanEnabled = cfg.SectionWithEnvOverrides("secretscan").Key("enabled").MustBool(false)
	s.secretScanInterval = cfg.SectionWithEnvOverrides("secretscan").
		Key("interval").MustDuration(defaultSecretScanInterval)
	if s.secretScanEnabled {
		var errSecret error
		s.secretScanService, errSecret = secretscan.NewService(s.store, cfg)
		if errSecret != nil {
			s.secretScanEnabled = false
			s.log.Warn("Failed to initialize secret scan service. secret scan is disabled",
				"error", errSecret.Error())
		}
	}

	return s, nil
}

func (sa *ServiceAccountsService) Run(ctx context.Context) error {
	sa.backgroundLog.Debug("Service initialized")

	if _, err := sa.getUsageMetrics(ctx); err != nil {
		sa.log.Warn("Failed to get usage metrics", "error", err.Error())
	}

	updateStatsTicker := time.NewTicker(metricsCollectionInterval)
	defer updateStatsTicker.Stop()

	// Enforce a minimum interval of 1 minute.
	if sa.secretScanEnabled && sa.secretScanInterval < time.Minute {
		sa.backgroundLog.Warn("Secret scan interval is too low, increasing to " +
			defaultSecretScanInterval.String())

		sa.secretScanInterval = defaultSecretScanInterval
	}

	tokenCheckTicker := time.NewTicker(sa.secretScanInterval)

	if !sa.secretScanEnabled {
		tokenCheckTicker.Stop()
	} else {
		sa.backgroundLog.Debug("Enabled token secret check and executing first check")
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

			sa.backgroundLog.Debug("Stopped service account background service")

			return nil
		case <-updateStatsTicker.C:
			sa.backgroundLog.Debug("Updating usage metrics")

			if _, err := sa.getUsageMetrics(ctx); err != nil {
				sa.backgroundLog.Warn("Failed to get usage metrics", "error", err.Error())
			}
		case <-tokenCheckTicker.C:
			sa.backgroundLog.Debug("Checking for leaked tokens")

			if err := sa.secretScanService.CheckTokens(ctx); err != nil {
				sa.backgroundLog.Warn("Failed to check for leaked tokens", "error", err.Error())
			}
		}
	}
}

var _ serviceaccounts.Service = (*ServiceAccountsService)(nil)

func (sa *ServiceAccountsService) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	if err := validOrgID(orgID); err != nil {
		return nil, err
	}

	var serviceAccount *serviceaccounts.ServiceAccountDTO
	err := sa.db.InTransaction(ctx, func(ctx context.Context) error {
		var err error
		serviceAccount, err = sa.store.CreateServiceAccount(ctx, orgID, saForm)
		if err != nil {
			return err
		}

		user, err := identity.GetRequester(ctx)
		if err == nil && sa.cfg.RBAC.PermissionsOnCreation("service-account") {
			if user.IsIdentityType(claims.TypeUser) {
				userID, err := user.GetInternalID()
				if err != nil {
					return err
				}

				if _, err := sa.permissions.SetUserPermission(ctx,
					orgID, accesscontrol.User{ID: userID},
					strconv.FormatInt(serviceAccount.Id, 10), "Admin"); err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return serviceAccount, nil
}

func (sa *ServiceAccountsService) RetrieveServiceAccount(ctx context.Context, query *serviceaccounts.GetServiceAccountQuery) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	if err := validOrgID(query.OrgID); err != nil {
		return nil, err
	}
	if err := validServiceAccountID(query.ID); err != nil {
		if err := validServiceAccountUID(query.UID); err != nil {
			return nil, fmt.Errorf("invalid service account ID %d and UID %s has been specified", query.ID, query.UID)
		}
	}
	return sa.store.RetrieveServiceAccount(ctx, query)
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
	if err := sa.store.DeleteServiceAccount(ctx, orgID, serviceAccountID); err != nil {
		return err
	}
	if err := sa.acService.DeleteUserPermissions(ctx, orgID, serviceAccountID); err != nil {
		return err
	}
	return sa.permissions.DeleteResourcePermissions(ctx, orgID, fmt.Sprintf("%d", serviceAccountID))
}

func (sa *ServiceAccountsService) EnableServiceAccount(ctx context.Context, orgID, serviceAccountID int64, enable bool) error {
	if err := validOrgID(orgID); err != nil {
		return err
	}
	if err := validServiceAccountID(serviceAccountID); err != nil {
		return err
	}
	return sa.store.EnableServiceAccount(ctx, orgID, serviceAccountID, enable)
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
func (sa *ServiceAccountsService) MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) (*serviceaccounts.MigrationResult, error) {
	if err := validOrgID(orgID); err != nil {
		return nil, err
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

func validServiceAccountUID(saUID string) error {
	if saUID == "" {
		return serviceaccounts.ErrServiceAccountInvalidID.Errorf("invalid service account UID has been specified")
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
