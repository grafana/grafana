package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	sdkproxy "github.com/grafana/grafana-plugin-sdk-go/backend/proxy"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	maxDatasourceNameLen = 190
	maxDatasourceUrlLen  = 255
)

type Service struct {
	SQLStore                  Store
	SecretsStore              kvstore.SecretsKVStore
	SecretsService            secrets.Service
	cfg                       *setting.Cfg
	features                  featuremgmt.FeatureToggles
	permissionsService        accesscontrol.DatasourcePermissionsService
	ac                        accesscontrol.AccessControl
	logger                    log.Logger
	db                        db.DB
	pluginStore               pluginstore.Store
	pluginClient              plugins.Client
	basePluginContextProvider plugincontext.BasePluginContextProvider

	ptc proxyTransportCache
}

type proxyTransportCache struct {
	cache map[int64]cachedRoundTripper
	sync.Mutex
}

type cachedRoundTripper struct {
	updated      time.Time
	roundTripper http.RoundTripper
}

func ProvideService(
	db db.DB, secretsService secrets.Service, secretsStore kvstore.SecretsKVStore, cfg *setting.Cfg,
	features featuremgmt.FeatureToggles, ac accesscontrol.AccessControl, datasourcePermissionsService accesscontrol.DatasourcePermissionsService,
	quotaService quota.Service, pluginStore pluginstore.Store, pluginClient plugins.Client,
	basePluginContextProvider plugincontext.BasePluginContextProvider,
) (*Service, error) {
	dslogger := log.New("datasources")
	store := &SqlStore{db: db, logger: dslogger, features: features}
	s := &Service{
		SQLStore:       store,
		SecretsStore:   secretsStore,
		SecretsService: secretsService,
		ptc: proxyTransportCache{
			cache: make(map[int64]cachedRoundTripper),
		},
		cfg:                       cfg,
		features:                  features,
		permissionsService:        datasourcePermissionsService,
		ac:                        ac,
		logger:                    dslogger,
		db:                        db,
		pluginStore:               pluginStore,
		pluginClient:              pluginClient,
		basePluginContextProvider: basePluginContextProvider,
	}

	ac.RegisterScopeAttributeResolver(NewNameScopeResolver(store))
	ac.RegisterScopeAttributeResolver(NewIDScopeResolver(store))

	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return nil, err
	}

	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     datasources.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      s.Usage,
	}); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Service) Usage(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	return s.SQLStore.Count(ctx, scopeParams)
}

// DataSourceRetriever interface for retrieving a datasource.
type DataSourceRetriever interface {
	// GetDataSource gets a datasource.
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error)
}

// NewNameScopeResolver provides an ScopeAttributeResolver able to
// translate a scope prefixed with "datasources:name:" into an uid based scope.
func NewNameScopeResolver(db DataSourceRetriever) (string, accesscontrol.ScopeAttributeResolver) {
	prefix := datasources.ScopeProvider.GetResourceScopeName("")
	return prefix, accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, initialScope string) ([]string, error) {
		if !strings.HasPrefix(initialScope, prefix) {
			return nil, accesscontrol.ErrInvalidScope
		}

		dsName := initialScope[len(prefix):]
		if dsName == "" {
			return nil, accesscontrol.ErrInvalidScope
		}

		query := datasources.GetDataSourceQuery{Name: dsName, OrgID: orgID}
		dataSource, err := db.GetDataSource(ctx, &query)
		if err != nil {
			return nil, err
		}

		return []string{datasources.ScopeProvider.GetResourceScopeUID(dataSource.UID)}, nil
	})
}

// NewIDScopeResolver provides an ScopeAttributeResolver able to
// translate a scope prefixed with "datasources:id:" into an uid based scope.
func NewIDScopeResolver(db DataSourceRetriever) (string, accesscontrol.ScopeAttributeResolver) {
	prefix := datasources.ScopeProvider.GetResourceScope("")
	return prefix, accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, initialScope string) ([]string, error) {
		if !strings.HasPrefix(initialScope, prefix) {
			return nil, accesscontrol.ErrInvalidScope
		}

		id := initialScope[len(prefix):]
		if id == "" {
			return nil, accesscontrol.ErrInvalidScope
		}

		dsID, err := strconv.ParseInt(id, 10, 64)
		if err != nil {
			return nil, accesscontrol.ErrInvalidScope
		}

		query := datasources.GetDataSourceQuery{ID: dsID, OrgID: orgID}
		dataSource, err := db.GetDataSource(ctx, &query)
		if err != nil {
			return nil, err
		}

		return []string{datasources.ScopeProvider.GetResourceScopeUID(dataSource.UID)}, nil
	})
}

func (s *Service) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	return s.SQLStore.GetDataSource(ctx, query)
}

func (s *Service) GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) ([]*datasources.DataSource, error) {
	return s.SQLStore.GetDataSources(ctx, query)
}

func (s *Service) GetAllDataSources(ctx context.Context, query *datasources.GetAllDataSourcesQuery) (res []*datasources.DataSource, err error) {
	return s.SQLStore.GetAllDataSources(ctx, query)
}

func (s *Service) GetPrunableProvisionedDataSources(ctx context.Context) (res []*datasources.DataSource, err error) {
	return s.SQLStore.GetPrunableProvisionedDataSources(ctx)
}

func (s *Service) GetDataSourcesByType(ctx context.Context, query *datasources.GetDataSourcesByTypeQuery) ([]*datasources.DataSource, error) {
	if query.AliasIDs == nil {
		// Populate alias IDs from plugin store
		p, found := s.pluginStore.Plugin(ctx, query.Type)
		if !found {
			return nil, fmt.Errorf("plugin %s not found", query.Type)
		}
		query.AliasIDs = p.AliasIDs
	}
	return s.SQLStore.GetDataSourcesByType(ctx, query)
}

func (s *Service) AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) (*datasources.DataSource, error) {
	dataSources, err := s.SQLStore.GetDataSources(ctx, &datasources.GetDataSourcesQuery{OrgID: cmd.OrgID})
	if err != nil {
		return nil, err
	}

	// Set the first created data source as default
	if len(dataSources) == 0 {
		cmd.IsDefault = true
	}

	if cmd.Name == "" {
		cmd.Name = getAvailableName(cmd.Type, dataSources)
	}

	// Validate the command
	jd, err := cmd.JsonData.ToDB()
	if err != nil {
		return nil, fmt.Errorf("invalid jsonData")
	}

	settings, err := s.prepareInstanceSettings(ctx, &backend.DataSourceInstanceSettings{
		UID:                     cmd.UID,
		Name:                    cmd.Name,
		URL:                     cmd.URL,
		Database:                cmd.Database,
		JSONData:                jd,
		DecryptedSecureJSONData: cmd.SecureJsonData,
		Type:                    cmd.Type,
		User:                    cmd.User,
		BasicAuthEnabled:        cmd.BasicAuth,
		BasicAuthUser:           cmd.BasicAuthUser,
		APIVersion:              cmd.APIVersion,
	}, nil)
	if err != nil {
		return nil, err
	}

	// The mutable properties
	cmd.URL = settings.URL
	cmd.User = settings.User
	cmd.BasicAuth = settings.BasicAuthEnabled
	cmd.BasicAuthUser = settings.BasicAuthUser
	cmd.Database = settings.Database
	cmd.SecureJsonData = settings.DecryptedSecureJSONData
	cmd.JsonData = nil
	if settings.JSONData != nil {
		cmd.JsonData = simplejson.New()
		err := cmd.JsonData.FromDB(settings.JSONData)
		if err != nil {
			return nil, err
		}
	}

	var dataSource *datasources.DataSource
	err = s.db.InTransaction(ctx, func(ctx context.Context) error {
		var err error

		cmd.EncryptedSecureJsonData = make(map[string][]byte)
		cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
		if err != nil {
			return err
		}

		cmd.UpdateSecretFn = func() error {
			secret, err := json.Marshal(cmd.SecureJsonData)
			if err != nil {
				return err
			}

			return s.SecretsStore.Set(ctx, cmd.OrgID, cmd.Name, kvstore.DataSourceSecretType, string(secret))
		}

		dataSource, err = s.SQLStore.AddDataSource(ctx, cmd)
		if err != nil {
			return err
		}

		if s.cfg.RBAC.PermissionsOnCreation("datasource") {
			// This belongs in Data source permissions, and we probably want
			// to do this with a hook in the store and rollback on fail.
			// We can't use events, because there's no way to communicate
			// failure, and we want "not being able to set default perms"
			// to fail the creation.
			permissions := []accesscontrol.SetResourcePermissionCommand{
				{BuiltinRole: "Viewer", Permission: "Query"},
				{BuiltinRole: "Editor", Permission: "Query"},
			}
			if cmd.UserID != 0 {
				permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{UserID: cmd.UserID, Permission: "Admin"})
			}
			if _, err = s.permissionsService.SetPermissions(ctx, cmd.OrgID, dataSource.UID, permissions...); err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return dataSource, nil
}

// This will valid validate the instance settings return a version that is safe to be saved
func (s *Service) prepareInstanceSettings(ctx context.Context, settings *backend.DataSourceInstanceSettings, ds *datasources.DataSource) (*backend.DataSourceInstanceSettings, error) {
	operation := backend.AdmissionRequestCreate

	// First apply global validation rules -- these are required regardless which plugin we are talking to
	if len(settings.Name) > maxDatasourceNameLen {
		return nil, datasources.ErrDataSourceNameInvalid.Errorf("max length is %d", maxDatasourceNameLen)
	}

	if len(settings.URL) > maxDatasourceUrlLen {
		return nil, datasources.ErrDataSourceURLInvalid.Errorf("max length is %d", maxDatasourceUrlLen)
	}

	if settings.Type == "" {
		return settings, nil // NOOP used in tests
	}

	// Make sure it is a known plugin type
	p, found := s.pluginStore.Plugin(ctx, settings.Type)
	if !found {
		// Ignore non-existing plugins for the time being
		return settings, nil
	}

	// When the APIVersion is set, the client must also implement AdmissionHandler
	if settings.APIVersion == "" {
		return settings, nil // NOOP
	}

	pb, err := backend.DataSourceInstanceSettingsToProtoBytes(settings)
	if err != nil {
		return nil, err
	}

	pluginContext := s.basePluginContextProvider.GetBasePluginContext(ctx, p, nil)
	if ds != nil {
		datasourceSettings, err := adapters.ModelToInstanceSettings(ds, s.decryptSecureJsonDataFn(ctx))
		if err != nil {
			return nil, err
		}
		pluginContext.DataSourceInstanceSettings = datasourceSettings
	}

	req := &backend.AdmissionRequest{
		Operation:     backend.AdmissionRequestCreate,
		PluginContext: pluginContext,
		Kind:          settings.GVK(),
		ObjectBytes:   pb,
	}

	// Set the old bytes and change the operation
	if pluginContext.DataSourceInstanceSettings != nil {
		req.Operation = backend.AdmissionRequestUpdate
		req.OldObjectBytes, err = backend.DataSourceInstanceSettingsToProtoBytes(settings)
		if err != nil {
			return nil, err
		}
	}

	{ // As an example, this will first call validate (then mutate)
		// Implementations may vary, but typically validation is
		// more strict because it does not have the option to fix anything
		// that has reasonable fixes.
		rsp, err := s.pluginClient.ValidateAdmission(ctx, req)
		if err != nil {
			if errors.Is(err, plugins.ErrMethodNotImplemented) {
				if settings.APIVersion == "v0alpha1" {
					// For v0alpha1 we don't require plugins to implement ValidateAdmission
					return settings, nil
				}
				return nil, errutil.Internal("plugin.unimplemented").
					Errorf("plugin (%s) with apiVersion=%s must implement ValidateAdmission", p.ID, settings.APIVersion)
			}
			return nil, err
		}
		if rsp == nil {
			return nil, fmt.Errorf("expected response (%v)", operation)
		}
		if !rsp.Allowed {
			if rsp.Result != nil {
				return nil, toError(rsp.Result)
			}
			return nil, fmt.Errorf("not allowed")
		}
		// payload is OK, but now lets do the mutate version...
	}

	// Next calling mutation -- this will try to get the input into an acceptable form
	rsp, err := s.pluginClient.MutateAdmission(ctx, req)
	if err != nil {
		if errors.Is(err, plugins.ErrMethodNotImplemented) {
			if settings.APIVersion == "v0alpha1" {
				// For v0alpha1 we don't require plugins to implement MutateAdmission
				return settings, nil
			}
			return nil, errutil.Internal("plugin.unimplemented").
				Errorf("plugin (%s) with apiVersion=%s must implement MutateAdmission", p.ID, settings.APIVersion)
		}
		return nil, err
	}
	if rsp == nil {
		return nil, fmt.Errorf("expected response (%v)", operation)
	}
	if !rsp.Allowed {
		if rsp.Result != nil {
			return nil, toError(rsp.Result)
		}
		return nil, fmt.Errorf("not allowed")
	}
	if rsp.ObjectBytes == nil {
		return nil, fmt.Errorf("mutation response is missing value")
	}
	return backend.DataSourceInstanceSettingsFromProto(rsp.ObjectBytes, pluginContext.PluginID)
}

func toError(status *backend.StatusResult) error {
	if status == nil {
		return fmt.Errorf("error converting status")
	}
	// hymm -- no way to pass the raw http status along!!
	// Looks like it must be based on the reason string
	return errutil.Error{
		Reason:        errutil.CoreStatus(status.Reason),
		MessageID:     "datasource.config.mutate",
		LogMessage:    status.Message,
		PublicMessage: status.Message,
		Source:        errutil.SourceDownstream,
	}
}

// getAvailableName finds the first available name for a datasource of the given type.
func getAvailableName(dsType string, dataSources []*datasources.DataSource) string {
	dsNames := make(map[string]bool)
	for _, ds := range dataSources {
		dsNames[strings.ToLower(ds.Name)] = true
	}

	name := dsType
	currentDigit := 0

	for dsNames[strings.ToLower(name)] {
		currentDigit++
		name = fmt.Sprintf("%s-%d", dsType, currentDigit)
	}

	return name
}

func (s *Service) DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error {
	return s.db.InTransaction(ctx, func(ctx context.Context) error {
		cmd.UpdateSecretFn = func() error {
			return s.SecretsStore.Del(ctx, cmd.OrgID, cmd.Name, kvstore.DataSourceSecretType)
		}

		if err := s.SQLStore.DeleteDataSource(ctx, cmd); err != nil {
			return err
		}

		return s.permissionsService.DeleteResourcePermissions(ctx, cmd.OrgID, cmd.UID)
	})
}

func (s *Service) decryptSecureJsonDataFn(ctx context.Context) func(ds *datasources.DataSource) (map[string]string, error) {
	return func(ds *datasources.DataSource) (map[string]string, error) {
		return s.DecryptedValues(ctx, ds)
	}
}

func (s *Service) UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) (*datasources.DataSource, error) {
	var dataSource *datasources.DataSource

	return dataSource, s.db.InTransaction(ctx, func(ctx context.Context) error {
		var err error

		query := &datasources.GetDataSourceQuery{
			ID:    cmd.ID,
			OrgID: cmd.OrgID,
		}
		dataSource, err = s.SQLStore.GetDataSource(ctx, query)
		if err != nil {
			return err
		}

		// Validate the command
		jd, err := cmd.JsonData.ToDB()
		if err != nil {
			return fmt.Errorf("invalid jsonData")
		}

		settings, err := s.prepareInstanceSettings(ctx,
			&backend.DataSourceInstanceSettings{
				UID:                     cmd.UID,
				Name:                    cmd.Name,
				URL:                     cmd.URL,
				Database:                cmd.Database,
				JSONData:                jd,
				DecryptedSecureJSONData: cmd.SecureJsonData,
				Type:                    cmd.Type,
				User:                    cmd.User,
				BasicAuthEnabled:        cmd.BasicAuth,
				BasicAuthUser:           cmd.BasicAuthUser,
				APIVersion:              cmd.APIVersion,
				Updated:                 time.Now(),
			}, dataSource)
		if err != nil {
			return err
		}
		if settings == nil {
			return fmt.Errorf("settings or an error is required")
		}

		// The mutable properties
		cmd.URL = settings.URL
		cmd.User = settings.User
		cmd.BasicAuth = settings.BasicAuthEnabled
		cmd.BasicAuthUser = settings.BasicAuthUser
		cmd.Database = settings.Database
		cmd.SecureJsonData = settings.DecryptedSecureJSONData
		cmd.JsonData = nil
		if settings.JSONData != nil {
			cmd.JsonData = simplejson.New()
			err := cmd.JsonData.FromDB(settings.JSONData)
			if err != nil {
				return err
			}
		}

		// preserve existing lbac rules when updating datasource if we're not updating lbac rules
		// TODO: Refactor to store lbac rules separate from a datasource
		if !cmd.AllowLBACRuleUpdates {
			s.logger.Debug("Overriding LBAC rules with stored ones using updateLBACRules API",
				"reason", "overriding_lbac_rules_from_datasource_api",
				"datasource_id", dataSource.ID,
				"datasource_uid", dataSource.UID)

			cmd.JsonData = RetainExistingLBACRules(dataSource.JsonData, cmd.JsonData)
		}

		if cmd.Name != "" && cmd.Name != dataSource.Name {
			query := &datasources.GetDataSourceQuery{
				Name:  cmd.Name,
				OrgID: cmd.OrgID,
			}
			exist, err := s.SQLStore.GetDataSource(ctx, query)
			if exist != nil {
				return datasources.ErrDataSourceNameExists
			}

			if err != nil && !errors.Is(err, datasources.ErrDataSourceNotFound) {
				return err
			}
		}

		err = s.fillWithSecureJSONData(ctx, cmd, dataSource)
		if err != nil {
			return err
		}

		if cmd.OrgID > 0 && cmd.Name != "" {
			cmd.UpdateSecretFn = func() error {
				secret, err := json.Marshal(cmd.SecureJsonData)
				if err != nil {
					return err
				}

				if dataSource.Name != cmd.Name {
					err := s.SecretsStore.Rename(ctx, cmd.OrgID, dataSource.Name, kvstore.DataSourceSecretType, cmd.Name)
					if err != nil {
						return err
					}
				}

				return s.SecretsStore.Set(ctx, cmd.OrgID, cmd.Name, kvstore.DataSourceSecretType, string(secret))
			}
		}

		dataSource, err = s.SQLStore.UpdateDataSource(ctx, cmd)
		return err
	})
}

func (s *Service) GetHTTPTransport(ctx context.Context, ds *datasources.DataSource, provider httpclient.Provider,
	customMiddlewares ...sdkhttpclient.Middleware) (http.RoundTripper, error) {
	s.ptc.Lock()
	defer s.ptc.Unlock()

	if t, present := s.ptc.cache[ds.ID]; present && ds.Updated.Equal(t.updated) {
		return t.roundTripper, nil
	}

	opts, err := s.httpClientOptions(ctx, ds)
	if err != nil {
		return nil, err
	}

	opts.Middlewares = append(opts.Middlewares, customMiddlewares...)

	rt, err := provider.GetTransport(*opts)
	if err != nil {
		return nil, err
	}

	s.ptc.cache[ds.ID] = cachedRoundTripper{
		roundTripper: rt,
		updated:      ds.Updated,
	}

	return rt, nil
}

func (s *Service) DecryptedValues(ctx context.Context, ds *datasources.DataSource) (map[string]string, error) {
	decryptedValues := make(map[string]string)
	secret, exist, err := s.SecretsStore.Get(ctx, ds.OrgID, ds.Name, kvstore.DataSourceSecretType)
	if err != nil {
		return nil, err
	}

	if exist {
		err = json.Unmarshal([]byte(secret), &decryptedValues)
		if err != nil {
			s.logger.Debug("Failed to unmarshal secret value, using legacy secrets", "err", err)
		}
	}

	if !exist || err != nil {
		decryptedValues, err = s.decryptLegacySecrets(ctx, ds)
		if err != nil {
			return nil, err
		}
	}

	return decryptedValues, nil
}

func (s *Service) decryptLegacySecrets(ctx context.Context, ds *datasources.DataSource) (map[string]string, error) {
	secureJsonData := make(map[string]string)
	for k, v := range ds.SecureJsonData {
		decrypted, err := s.SecretsService.Decrypt(ctx, v)
		if err != nil {
			return nil, err
		}
		secureJsonData[k] = string(decrypted)
	}
	return secureJsonData, nil
}

func (s *Service) DecryptedValue(ctx context.Context, ds *datasources.DataSource, key string) (string, bool, error) {
	values, err := s.DecryptedValues(ctx, ds)
	if err != nil {
		return "", false, err
	}
	value, exists := values[key]
	return value, exists, nil
}

func (s *Service) DecryptedBasicAuthPassword(ctx context.Context, ds *datasources.DataSource) (string, error) {
	value, ok, err := s.DecryptedValue(ctx, ds, "basicAuthPassword")
	if ok {
		return value, nil
	}

	return "", err
}

func (s *Service) DecryptedPassword(ctx context.Context, ds *datasources.DataSource) (string, error) {
	value, ok, err := s.DecryptedValue(ctx, ds, "password")
	if ok {
		return value, nil
	}

	return "", err
}

func (s *Service) httpClientOptions(ctx context.Context, ds *datasources.DataSource) (*sdkhttpclient.Options, error) {
	tlsOptions, err := s.dsTLSOptions(ctx, ds)
	if err != nil {
		return nil, err
	}

	timeouts := &sdkhttpclient.TimeoutOptions{
		Timeout:               s.getTimeout(ds),
		DialTimeout:           sdkhttpclient.DefaultTimeoutOptions.DialTimeout,
		KeepAlive:             sdkhttpclient.DefaultTimeoutOptions.KeepAlive,
		TLSHandshakeTimeout:   sdkhttpclient.DefaultTimeoutOptions.TLSHandshakeTimeout,
		ExpectContinueTimeout: sdkhttpclient.DefaultTimeoutOptions.ExpectContinueTimeout,
		MaxConnsPerHost:       sdkhttpclient.DefaultTimeoutOptions.MaxConnsPerHost,
		MaxIdleConns:          sdkhttpclient.DefaultTimeoutOptions.MaxIdleConns,
		MaxIdleConnsPerHost:   sdkhttpclient.DefaultTimeoutOptions.MaxIdleConnsPerHost,
		IdleConnTimeout:       sdkhttpclient.DefaultTimeoutOptions.IdleConnTimeout,
	}

	decryptedValues, err := s.DecryptedValues(ctx, ds)
	if err != nil {
		return nil, err
	}

	opts := &sdkhttpclient.Options{
		Timeouts: timeouts,
		Header:   s.getCustomHeaders(ds.JsonData, decryptedValues),
		Labels: map[string]string{
			"datasource_type": ds.Type,
			"datasource_name": ds.Name,
			"datasource_uid":  ds.UID,
		},
		TLS: &tlsOptions,
	}

	if ds.JsonData != nil {
		opts.CustomOptions = ds.JsonData.MustMap()
		// allow the plugin sdk to get the json data in JSONDataFromHTTPClientOptions
		deepJsonDataCopy := make(map[string]any, len(opts.CustomOptions))
		for k, v := range opts.CustomOptions {
			deepJsonDataCopy[k] = v
		}
		opts.CustomOptions["grafanaData"] = deepJsonDataCopy
	}
	if ds.BasicAuth {
		password, err := s.DecryptedBasicAuthPassword(ctx, ds)
		if err != nil {
			return opts, err
		}

		opts.BasicAuth = &sdkhttpclient.BasicAuthOptions{
			User:     ds.BasicAuthUser,
			Password: password,
		}
	} else if ds.User != "" {
		password, err := s.DecryptedPassword(ctx, ds)
		if err != nil {
			return opts, err
		}

		opts.BasicAuth = &sdkhttpclient.BasicAuthOptions{
			User:     ds.User,
			Password: password,
		}
	}

	if ds.IsSecureSocksDSProxyEnabled() {
		proxyOpts := &sdkproxy.Options{
			Enabled: true,
			Auth: &sdkproxy.AuthOptions{
				Username: ds.JsonData.Get("secureSocksProxyUsername").MustString(ds.UID),
			},
			Timeouts: &sdkproxy.DefaultTimeoutOptions,
			ClientCfg: &sdkproxy.ClientCfg{
				ClientCert:    s.cfg.SecureSocksDSProxy.ClientCertFilePath,
				ClientKey:     s.cfg.SecureSocksDSProxy.ClientKeyFilePath,
				RootCAs:       s.cfg.SecureSocksDSProxy.RootCAFilePaths,
				ClientCertVal: s.cfg.SecureSocksDSProxy.ClientCert,
				ClientKeyVal:  s.cfg.SecureSocksDSProxy.ClientKey,
				RootCAsVals:   s.cfg.SecureSocksDSProxy.RootCAs,
				ProxyAddress:  s.cfg.SecureSocksDSProxy.ProxyAddress,
				ServerName:    s.cfg.SecureSocksDSProxy.ServerName,
				AllowInsecure: s.cfg.SecureSocksDSProxy.AllowInsecure,
			},
		}

		if val, exists, err := s.DecryptedValue(ctx, ds, "secureSocksProxyPassword"); err == nil && exists {
			proxyOpts.Auth.Password = val
		}
		if val, err := ds.JsonData.Get("timeout").Float64(); err == nil {
			proxyOpts.Timeouts.Timeout = time.Duration(val) * time.Second
		}
		if val, err := ds.JsonData.Get("keepAlive").Float64(); err == nil {
			proxyOpts.Timeouts.KeepAlive = time.Duration(val) * time.Second
		}

		opts.ProxyOptions = proxyOpts
	}

	if ds.JsonData != nil && ds.JsonData.Get("sigV4Auth").MustBool(false) && s.cfg.SigV4AuthEnabled {
		opts.SigV4 = &sdkhttpclient.SigV4Config{
			Service:       awsServiceNamespace(ds.Type, ds.JsonData),
			Region:        ds.JsonData.Get("sigV4Region").MustString(),
			AssumeRoleARN: ds.JsonData.Get("sigV4AssumeRoleArn").MustString(),
			AuthType:      ds.JsonData.Get("sigV4AuthType").MustString(),
			ExternalID:    ds.JsonData.Get("sigV4ExternalId").MustString(),
			Profile:       ds.JsonData.Get("sigV4Profile").MustString(),
		}

		if val, exists, err := s.DecryptedValue(ctx, ds, "sigV4AccessKey"); err == nil {
			if exists {
				opts.SigV4.AccessKey = val
			}
		} else {
			return opts, err
		}

		if val, exists, err := s.DecryptedValue(ctx, ds, "sigV4SecretKey"); err == nil {
			if exists {
				opts.SigV4.SecretKey = val
			}
		} else {
			return opts, err
		}
	}

	return opts, nil
}

func (s *Service) dsTLSOptions(ctx context.Context, ds *datasources.DataSource) (sdkhttpclient.TLSOptions, error) {
	var tlsSkipVerify, tlsClientAuth, tlsAuthWithCACert bool
	var serverName string

	if ds.JsonData != nil {
		tlsClientAuth = ds.JsonData.Get("tlsAuth").MustBool(false)
		tlsAuthWithCACert = ds.JsonData.Get("tlsAuthWithCACert").MustBool(false)
		tlsSkipVerify = ds.JsonData.Get("tlsSkipVerify").MustBool(false)
		serverName = ds.JsonData.Get("serverName").MustString()
	}

	opts := sdkhttpclient.TLSOptions{
		InsecureSkipVerify: tlsSkipVerify,
		ServerName:         serverName,
	}

	if tlsClientAuth || tlsAuthWithCACert {
		if tlsAuthWithCACert {
			if val, exists, err := s.DecryptedValue(ctx, ds, "tlsCACert"); err == nil {
				if exists && len(val) > 0 {
					opts.CACertificate = val
				}
			} else {
				return opts, err
			}
		}

		if tlsClientAuth {
			if val, exists, err := s.DecryptedValue(ctx, ds, "tlsClientCert"); err == nil {
				if exists && len(val) > 0 {
					opts.ClientCertificate = val
				}
			} else {
				return opts, err
			}
			if val, exists, err := s.DecryptedValue(ctx, ds, "tlsClientKey"); err == nil {
				if exists && len(val) > 0 {
					opts.ClientKey = val
				}
			} else {
				return opts, err
			}
		}
	}

	return opts, nil
}

func (s *Service) getTimeout(ds *datasources.DataSource) time.Duration {
	timeout := 0
	if ds.JsonData != nil {
		timeout = ds.JsonData.Get("timeout").MustInt()
		if timeout <= 0 {
			if timeoutStr := ds.JsonData.Get("timeout").MustString(); timeoutStr != "" {
				if t, err := strconv.Atoi(timeoutStr); err == nil {
					timeout = t
				}
			}
		}
	}
	if timeout <= 0 {
		return sdkhttpclient.DefaultTimeoutOptions.Timeout
	}

	return time.Duration(timeout) * time.Second
}

// getCustomHeaders returns a map with all the to be set headers
// The map key represents the HeaderName and the value represents this header's value
func (s *Service) getCustomHeaders(jsonData *simplejson.Json, decryptedValues map[string]string) http.Header {
	headers := make(http.Header)
	if jsonData == nil {
		return headers
	}

	index := 0
	for {
		index++
		headerNameSuffix := fmt.Sprintf("%s%d", datasources.CustomHeaderName, index)
		headerValueSuffix := fmt.Sprintf("%s%d", datasources.CustomHeaderValue, index)

		key := jsonData.Get(headerNameSuffix).MustString()
		if key == "" {
			// No (more) header values are available
			break
		}

		// skip a header with name that corresponds to auth proxy header's name
		// to make sure that data source proxy isn't used to circumvent auth proxy.
		// For more context take a look at CVE-2022-35957
		if s.cfg.AuthProxy.Enabled && http.CanonicalHeaderKey(key) == http.CanonicalHeaderKey(s.cfg.AuthProxy.HeaderName) {
			continue
		}

		if val, ok := decryptedValues[headerValueSuffix]; ok {
			headers.Add(key, val)
		}
	}

	return headers
}

func awsServiceNamespace(dsType string, jsonData *simplejson.Json) string {
	switch dsType {
	case datasources.DS_ES, datasources.DS_ES_OPEN_DISTRO:
		return "es"
	case datasources.DS_ES_OPENSEARCH:
		serverless := jsonData.Get("serverless").MustBool()

		if serverless {
			return "aoss"
		} else {
			return "es"
		}
	case datasources.DS_PROMETHEUS, datasources.DS_AMAZON_PROMETHEUS, datasources.DS_ALERTMANAGER:
		return "aps"
	default:
		panic(fmt.Sprintf("Unsupported datasource %q", dsType))
	}
}

func (s *Service) fillWithSecureJSONData(ctx context.Context, cmd *datasources.UpdateDataSourceCommand, ds *datasources.DataSource) error {
	decrypted, err := s.DecryptedValues(ctx, ds)
	if err != nil {
		return err
	}

	if cmd.SecureJsonData == nil {
		cmd.SecureJsonData = make(map[string]string)
	}

	if !cmd.IgnoreOldSecureJsonData {
		for k, v := range decrypted {
			if _, ok := cmd.SecureJsonData[k]; !ok {
				cmd.SecureJsonData[k] = v
			}
		}
	}

	cmd.EncryptedSecureJsonData = make(map[string][]byte)
	cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return nil
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(datasources.QuotaTargetSrv, datasources.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return limits, err
	}
	orgQuotaTag, err := quota.NewTag(datasources.QuotaTargetSrv, datasources.QuotaTarget, quota.OrgScope)
	if err != nil {
		return limits, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.DataSource)
	limits.Set(orgQuotaTag, cfg.Quota.Org.DataSource)
	return limits, nil
}

// CustomerHeaders returns the custom headers specified in the datasource. The context is used for the decryption operation that might use the store, so consider setting an acceptable timeout for your use case.
func (s *Service) CustomHeaders(ctx context.Context, ds *datasources.DataSource) (http.Header, error) {
	values, err := s.SecretsService.DecryptJsonData(ctx, ds.SecureJsonData)
	if err != nil {
		return nil, fmt.Errorf("failed to get custom headers: %w", err)
	}
	return s.getCustomHeaders(ds.JsonData, values), nil
}

func RetainExistingLBACRules(storedJsonData, cmdJsonData *simplejson.Json) *simplejson.Json {
	// If there are no stored data, we should remove the key from the command json data
	if storedJsonData == nil {
		if cmdJsonData != nil {
			cmdJsonData.Del("teamHttpHeaders")
		}
		return cmdJsonData
	}

	previousRules := storedJsonData.Get("teamHttpHeaders").Interface()
	// If there are no previous rules, we should remove the key from the command json data
	if previousRules == nil {
		if cmdJsonData != nil {
			cmdJsonData.Del("teamHttpHeaders")
		}
		return cmdJsonData
	}

	if cmdJsonData == nil {
		// It's fine to instantiate a new JsonData here
		// Because it's done in the SQLStore.UpdateDataSource anyway
		cmdJsonData = simplejson.New()
	}
	cmdJsonData.Set("teamHttpHeaders", previousRules)
	return cmdJsonData
}
