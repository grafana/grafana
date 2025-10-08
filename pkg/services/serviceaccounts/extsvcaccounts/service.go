package extsvcaccounts

import (
	"context"
	"errors"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/satokengen"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/manager"
	"github.com/grafana/grafana/pkg/setting"
)

type ExtSvcAccountsService struct {
	acSvc        ac.Service
	defaultOrgID int64
	logger       log.Logger
	metrics      *metrics
	saSvc        sa.Service
	skvStore     kvstore.SecretsKVStore
	tracer       tracing.Tracer
	enabled      bool
}

func ProvideExtSvcAccountsService(acSvc ac.Service, cfg *setting.Cfg, bus bus.Bus, db db.DB, features featuremgmt.FeatureToggles, reg prometheus.Registerer, saSvc *manager.ServiceAccountsService, secretsSvc secrets.Service, tracer tracing.Tracer) *ExtSvcAccountsService {
	logger := log.New("serviceauth.extsvcaccounts")
	esa := &ExtSvcAccountsService{
		acSvc:        acSvc,
		defaultOrgID: cfg.DefaultOrgID(),
		logger:       logger,
		saSvc:        saSvc,
		skvStore:     kvstore.NewSQLSecretsKVStore(db, secretsSvc, logger), // Using SQL store to avoid a cyclic dependency
		tracer:       tracer,
		enabled:      cfg.ManagedServiceAccountsEnabled && features.IsEnabledGlobally(featuremgmt.FlagExternalServiceAccounts),
	}

	if esa.enabled {
		// Register the metrics
		esa.metrics = newMetrics(reg)

		// Register a listener to enable/disable service accounts
		bus.AddEventListener(esa.handlePluginStateChanged)
	}

	return esa
}

// EnableExtSvcAccount enables or disables the service account associated to an external service
func (esa *ExtSvcAccountsService) EnableExtSvcAccount(ctx context.Context, cmd *sa.EnableExtSvcAccountCmd) error {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.EnableExtSvcAccount")
	defer span.End()

	saName := sa.ExtSvcPrefix + slugify.Slugify(cmd.ExtSvcSlug)

	saID, errRetrieve := esa.saSvc.RetrieveServiceAccountIdByName(ctx, cmd.OrgID, saName)
	if errRetrieve != nil {
		return errRetrieve
	}

	return esa.saSvc.EnableServiceAccount(ctx, cmd.OrgID, saID, cmd.Enabled)
}

// HasExternalService returns whether an external service has been saved with that name.
func (esa *ExtSvcAccountsService) HasExternalService(ctx context.Context, name string) (bool, error) {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.HasExternalService")
	defer span.End()

	saName := sa.ExtSvcPrefix + slugify.Slugify(name)

	saID, errRetrieve := esa.saSvc.RetrieveServiceAccountIdByName(ctx, esa.defaultOrgID, saName)
	if errRetrieve != nil && !errors.Is(errRetrieve, sa.ErrServiceAccountNotFound) {
		return false, errRetrieve
	}

	return saID > 0, nil
}

// RetrieveExtSvcAccount fetches an external service account by ID
func (esa *ExtSvcAccountsService) RetrieveExtSvcAccount(ctx context.Context, orgID, saID int64) (*sa.ExtSvcAccount, error) {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.RetrieveExtSvcAccount")
	defer span.End()

	svcAcc, err := esa.saSvc.RetrieveServiceAccount(ctx, &sa.GetServiceAccountQuery{OrgID: orgID, ID: saID})
	if err != nil {
		return nil, err
	}
	return &sa.ExtSvcAccount{
		ID:         svcAcc.Id,
		Login:      svcAcc.Login,
		Name:       svcAcc.Name,
		OrgID:      svcAcc.OrgId,
		IsDisabled: svcAcc.IsDisabled,
		Role:       identity.RoleType(svcAcc.Role),
	}, nil
}

// GetExternalServiceNames get the names of External Service in store
func (esa *ExtSvcAccountsService) GetExternalServiceNames(ctx context.Context) ([]string, error) {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.GetExternalServiceNames")
	defer span.End()

	ctxLogger := esa.logger.FromContext(ctx)

	ctxLogger.Debug("Get external service names from store")
	sas, err := esa.saSvc.SearchOrgServiceAccounts(ctx, &sa.SearchOrgServiceAccountsQuery{
		OrgID:        esa.defaultOrgID,
		Filter:       sa.FilterOnlyExternal,
		SignedInUser: extsvcuser(esa.defaultOrgID),
	})
	if err != nil {
		ctxLogger.Error("Could not fetch external service accounts from store", "error", err.Error())
		return nil, err
	}
	if sas == nil {
		return []string{}, nil
	}
	res := make([]string, len(sas.ServiceAccounts))
	for i := range sas.ServiceAccounts {
		res[i] = strings.TrimPrefix(sas.ServiceAccounts[i].Name, sa.ExtSvcPrefix)
	}
	return res, nil
}

// SaveExternalService creates, updates or delete a service account (and its token) with the requested permissions.
func (esa *ExtSvcAccountsService) SaveExternalService(ctx context.Context, cmd *extsvcauth.ExternalServiceRegistration) (*extsvcauth.ExternalService, error) {
	// This is double proofing, we should never reach here anyway the flags have already been checked.
	if !esa.enabled {
		esa.logger.FromContext(ctx).Warn("This feature is behind a feature flag, please set it if you want to save external services")
		return nil, nil
	}

	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.SaveExternalService")
	defer span.End()

	ctxLogger := esa.logger.FromContext(ctx)

	if cmd == nil {
		ctxLogger.Warn("Received no input")
		return nil, nil
	}

	slug := slugify.Slugify(cmd.Name)

	saID, err := esa.ManageExtSvcAccount(ctx, &sa.ManageExtSvcAccountCmd{
		ExtSvcSlug:  slug,
		Enabled:     cmd.Self.Enabled,
		OrgID:       esa.defaultOrgID,
		Permissions: cmd.Self.Permissions,
	})
	if err != nil {
		return nil, err
	}

	// No need for a token if we don't have a service account
	if saID <= 0 {
		ctxLogger.Debug("Skipping service account token creation", "service", slug)
		return nil, nil
	}

	token, err := esa.getExtSvcAccountToken(ctx, esa.defaultOrgID, saID, slug)
	if err != nil {
		ctxLogger.Error("Could not get the external svc token",
			"service", slug,
			"saID", saID,
			"error", err.Error())
		return nil, err
	}
	return &extsvcauth.ExternalService{Name: slug, ID: slug, Secret: token}, nil
}

func (esa *ExtSvcAccountsService) RemoveExternalService(ctx context.Context, name string) error {
	// This is double proofing, we should never reach here anyway the flags have already been checked.
	if !esa.enabled {
		esa.logger.Warn("This feature is behind a feature flag, please set it if you want to save external services")
		return nil
	}

	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.RemoveExternalService")
	defer span.End()

	return esa.RemoveExtSvcAccount(ctx, esa.defaultOrgID, slugify.Slugify(name))
}

func (esa *ExtSvcAccountsService) RemoveExtSvcAccount(ctx context.Context, orgID int64, extSvcSlug string) error {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.RemoveExtSvcAccount")
	defer span.End()

	ctxLogger := esa.logger.FromContext(ctx)

	saID, errRetrieve := esa.saSvc.RetrieveServiceAccountIdByName(ctx, orgID, sa.ExtSvcPrefix+extSvcSlug)
	if errRetrieve != nil && !errors.Is(errRetrieve, sa.ErrServiceAccountNotFound) {
		return errRetrieve
	}

	if saID <= 0 {
		ctxLogger.Debug("No external service account associated with this service", "service", extSvcSlug, "orgID", orgID)
		return nil
	}

	if err := esa.deleteExtSvcAccount(ctx, orgID, extSvcSlug, saID); err != nil {
		ctxLogger.Error("Error occurred while deleting service account",
			"service", extSvcSlug,
			"saID", saID,
			"error", err.Error())
		return err
	}
	esa.logger.Info("Deleted external service account", "service", extSvcSlug, "orgID", orgID)
	return nil
}

// ManageExtSvcAccount creates, updates or deletes the service account associated with an external service
func (esa *ExtSvcAccountsService) ManageExtSvcAccount(ctx context.Context, cmd *sa.ManageExtSvcAccountCmd) (int64, error) {
	// This is double proofing, we should never reach here anyway the flags have already been checked.
	if !esa.enabled {
		esa.logger.FromContext(ctx).Warn("This feature is behind a feature flag, please set it if you want to save external services")
		return 0, nil
	}

	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.ManageExtSvcAccount")
	defer span.End()

	ctxLogger := esa.logger.FromContext(ctx)

	if cmd == nil {
		ctxLogger.Warn("Received no input")
		return 0, nil
	}

	saID, errRetrieve := esa.saSvc.RetrieveServiceAccountIdByName(ctx, cmd.OrgID, sa.ExtSvcPrefix+cmd.ExtSvcSlug)
	if errRetrieve != nil && !errors.Is(errRetrieve, sa.ErrServiceAccountNotFound) {
		return 0, errRetrieve
	}

	if len(cmd.Permissions) == 0 {
		if saID > 0 {
			if err := esa.deleteExtSvcAccount(ctx, cmd.OrgID, cmd.ExtSvcSlug, saID); err != nil {
				ctxLogger.Error("Error occurred while deleting service account",
					"service", cmd.ExtSvcSlug,
					"saID", saID,
					"error", err.Error())
				return 0, err
			}
		}
		ctxLogger.Info("Skipping service account creation, no permission",
			"service", cmd.ExtSvcSlug,
			"permission count", len(cmd.Permissions),
			"saID", saID)
		return 0, nil
	}

	saID, errSave := esa.saveExtSvcAccount(ctx, &saveCmd{
		Enabled:     cmd.Enabled,
		ExtSvcSlug:  cmd.ExtSvcSlug,
		OrgID:       cmd.OrgID,
		Permissions: cmd.Permissions,
		SaID:        saID,
	})
	if errSave != nil {
		ctxLogger.Error("Could not save service account", "service", cmd.ExtSvcSlug, "error", errSave.Error())
		return 0, errSave
	}
	return saID, nil
}

// saveExtSvcAccount creates or updates the service account associated with an external service
func (esa *ExtSvcAccountsService) saveExtSvcAccount(ctx context.Context, cmd *saveCmd) (int64, error) {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.saveExtSvcAccount")
	defer span.End()

	ctxLogger := esa.logger.FromContext(ctx)

	if cmd.SaID <= 0 {
		// Create a service account
		ctxLogger.Info("Create service account", "service", cmd.ExtSvcSlug, "orgID", cmd.OrgID)
		sa, err := esa.saSvc.CreateServiceAccount(ctx, cmd.OrgID, &sa.CreateServiceAccountForm{
			Name:       sa.ExtSvcPrefix + cmd.ExtSvcSlug,
			Role:       newRole(identity.RoleNone),
			IsDisabled: newBool(false),
		})
		if err != nil {
			return 0, err
		}
		cmd.SaID = sa.Id
	}

	// Enable or disable the service account
	ctxLogger.Debug("Set service account state", "service", cmd.ExtSvcSlug, "saID", cmd.SaID, "enabled", cmd.Enabled)
	if err := esa.saSvc.EnableServiceAccount(ctx, cmd.OrgID, cmd.SaID, cmd.Enabled); err != nil {
		return 0, err
	}

	// update the service account's permissions
	ctxLogger.Debug("Update role permissions", "service", cmd.ExtSvcSlug, "saID", cmd.SaID)
	if err := esa.acSvc.SaveExternalServiceRole(ctx, ac.SaveExternalServiceRoleCommand{
		AssignmentOrgID:   cmd.OrgID,
		ExternalServiceID: cmd.ExtSvcSlug,
		ServiceAccountID:  cmd.SaID,
		Permissions:       cmd.Permissions,
	}); err != nil {
		return 0, err
	}

	esa.metrics.savedCount.Inc()

	return cmd.SaID, nil
}

// deleteExtSvcAccount deletes a service account by ID and removes its associated role
func (esa *ExtSvcAccountsService) deleteExtSvcAccount(ctx context.Context, orgID int64, slug string, saID int64) error {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.deleteExtSvcAccount")
	defer span.End()

	ctxLogger := esa.logger.FromContext(ctx)

	ctxLogger.Info("Delete service account", "service", slug, "orgID", orgID, "saID", saID)
	if err := esa.saSvc.DeleteServiceAccount(ctx, orgID, saID); err != nil {
		return err
	}
	if err := esa.acSvc.DeleteExternalServiceRole(ctx, slug); err != nil {
		return err
	}
	if err := esa.DeleteExtSvcCredentials(ctx, orgID, slug); err != nil {
		return err
	}
	esa.metrics.deletedCount.Inc()
	return nil
}

// getExtSvcAccountToken get or create the token of an External Service
func (esa *ExtSvcAccountsService) getExtSvcAccountToken(ctx context.Context, orgID, saID int64, extSvcSlug string) (string, error) {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.getExtSvcAccountToken")
	defer span.End()

	ctxLogger := esa.logger.FromContext(ctx)

	// Get credentials from store
	credentials, err := esa.GetExtSvcCredentials(ctx, orgID, extSvcSlug)
	if err != nil && !errors.Is(err, ErrCredentialsNotFound) {
		if !errors.Is(err, satokengen.ErrInvalidApiKey) {
			return "", err
		}
		ctxLogger.Warn("Invalid token found in store, recovering...", "service", extSvcSlug, "orgID", orgID)
		if err := esa.removeExtSvcAccountToken(ctx, orgID, saID, extSvcSlug); err != nil {
			return "", err
		}
	}
	if credentials != nil {
		return credentials.Secret, nil
	}

	// Generate token
	ctxLogger.Info("Generate new service account token", "service", extSvcSlug, "orgID", orgID)
	newKeyInfo, err := genTokenWithRetries(ctxLogger, extSvcSlug)
	if err != nil {
		return "", err
	}

	ctxLogger.Debug("Add service account token", "service", extSvcSlug, "orgID", orgID)
	if _, err := esa.saSvc.AddServiceAccountToken(ctx, saID, &sa.AddServiceAccountTokenCommand{
		Name:  tokenName(extSvcSlug),
		OrgId: orgID,
		Key:   newKeyInfo.HashedKey,
	}); err != nil {
		return "", err
	}

	if err := esa.SaveExtSvcCredentials(ctx, &SaveCredentialsCmd{
		ExtSvcSlug: extSvcSlug,
		OrgID:      orgID,
		Secret:     newKeyInfo.ClientSecret,
	}); err != nil {
		return "", err
	}

	return newKeyInfo.ClientSecret, nil
}

func (esa *ExtSvcAccountsService) removeExtSvcAccountToken(ctx context.Context, orgID, saID int64, extSvcSlug string) error {
	ctx, span := esa.tracer.Start(ctx, "ExtSvcAccountsService.removeExtSvcAccountToken")
	defer span.End()

	ctxLogger := esa.logger.FromContext(ctx)
	ctxLogger.Debug("List service account tokens", "service", extSvcSlug, "orgID", orgID)
	tokens, err := esa.saSvc.ListTokens(ctx, &sa.GetSATokensQuery{OrgID: &orgID, ServiceAccountID: &saID})
	if err != nil {
		return err
	}
	notFound := int64(-1)
	tknID := notFound
	for _, token := range tokens {
		if token.Name == tokenName(extSvcSlug) {
			ctxLogger.Debug("Found token", "service", extSvcSlug, "orgID", orgID)
			tknID = token.ID
			break
		}
	}
	if tknID != notFound {
		ctxLogger.Debug("Remove token", "service", extSvcSlug, "orgID", orgID)
		if err := esa.saSvc.DeleteServiceAccountToken(ctx, orgID, saID, tknID); err != nil {
			return err
		}
	}
	return esa.DeleteExtSvcCredentials(ctx, orgID, extSvcSlug)
}

// FIXME: If the warning log never appears, we can remove this function
func genTokenWithRetries(ctxLogger log.Logger, extSvcSlug string) (satokengen.KeyGenResult, error) {
	var newKeyInfo satokengen.KeyGenResult
	var err error
	retry := 0
	for retry < maxTokenGenRetries {
		newKeyInfo, err = satokengen.New(extSvcSlug)
		if err != nil {
			return satokengen.KeyGenResult{}, err
		}

		if !strings.Contains(newKeyInfo.ClientSecret, "\x00") {
			return newKeyInfo, nil
		}

		retry++

		ctxLogger.Warn("Generated a token containing NUL, retrying",
			"service", extSvcSlug,
			"retry", retry,
		)
		// On first retry, log the token parts that contain a nil byte
		if retry == 1 {
			logTokenNULParts(ctxLogger, extSvcSlug, newKeyInfo.ClientSecret)
		}
	}

	return satokengen.KeyGenResult{}, ErrCredentialsGenFailed.Errorf("Failed to generate a token for %s", extSvcSlug)
}

// logTokenNULParts logs a warning if the external service token contains a nil byte
// Tokens normally have 3 parts "gl+serviceID_secret_checksum"
// Log the part of the generated token that contains a nil byte
func logTokenNULParts(ctxLogger log.Logger, extSvcSlug string, token string) {
	parts := strings.Split(token, "_")
	for i := range parts {
		if strings.Contains(parts[i], "\x00") {
			ctxLogger.Warn("Token contains NUL",
				"service", extSvcSlug,
				"part", i,
				"part_len", len(parts[i]),
				"parts_count", len(parts),
			)
		}
	}
}

// GetExtSvcCredentials get the credentials of an External Service from an encrypted storage
func (esa *ExtSvcAccountsService) GetExtSvcCredentials(ctx context.Context, orgID int64, extSvcSlug string) (*Credentials, error) {
	ctxLogger := esa.logger.FromContext(ctx)
	ctxLogger.Debug("Get service account token from skv", "service", extSvcSlug, "orgID", orgID)
	token, ok, err := esa.skvStore.Get(ctx, orgID, extSvcSlug, kvStoreType)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrCredentialsNotFound.Errorf("No credential found for in store %v", extSvcSlug)
	}
	if _, err := satokengen.Decode(token); err != nil {
		ctxLogger.Error("Failed to decode token", "error", err.Error())
		return nil, err
	}
	return &Credentials{Secret: token}, nil
}

// SaveExtSvcCredentials stores the credentials of an External Service in an encrypted storage
func (esa *ExtSvcAccountsService) SaveExtSvcCredentials(ctx context.Context, cmd *SaveCredentialsCmd) error {
	ctxLogger := esa.logger.FromContext(ctx)
	ctxLogger.Debug("Save service account token in skv", "service", cmd.ExtSvcSlug, "orgID", cmd.OrgID)
	return esa.skvStore.Set(ctx, cmd.OrgID, cmd.ExtSvcSlug, kvStoreType, cmd.Secret)
}

// DeleteExtSvcCredentials removes the credentials of an External Service from an encrypted storage
func (esa *ExtSvcAccountsService) DeleteExtSvcCredentials(ctx context.Context, orgID int64, extSvcSlug string) error {
	ctxLogger := esa.logger.FromContext(ctx)
	ctxLogger.Debug("Delete service account token from skv", "service", extSvcSlug, "orgID", orgID)
	return esa.skvStore.Del(ctx, orgID, extSvcSlug, kvStoreType)
}

func (esa *ExtSvcAccountsService) handlePluginStateChanged(ctx context.Context, event *pluginsettings.PluginStateChangedEvent) error {
	ctxLogger := esa.logger.FromContext(ctx)
	ctxLogger.Debug("Plugin state changed", "pluginId", event.PluginId, "enabled", event.Enabled)

	errEnable := esa.EnableExtSvcAccount(ctx, &sa.EnableExtSvcAccountCmd{
		ExtSvcSlug: event.PluginId,
		Enabled:    event.Enabled,
		OrgID:      event.OrgId,
	})

	// Ignore service account not found error
	if errors.Is(errEnable, sa.ErrServiceAccountNotFound) {
		ctxLogger.Debug("No ext svc account with this plugin", "pluginId", event.PluginId, "orgId", event.OrgId)
		return nil
	}
	return errEnable
}

func tokenName(extSvcSlug string) string {
	return tokenNamePrefix + "-" + extSvcSlug
}
