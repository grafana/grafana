package service

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	SQLStore           Store
	SecretsStore       kvstore.SecretsKVStore
	SecretsService     secrets.Service
	cfg                *setting.Cfg
	features           featuremgmt.FeatureToggles
	permissionsService accesscontrol.DatasourcePermissionsService
	ac                 accesscontrol.AccessControl
	logger             log.Logger
	db                 db.DB

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
	quotaService quota.Service,
) (*Service, error) {
	dslogger := log.New("datasources")
	store := &SqlStore{db: db, logger: dslogger}
	s := &Service{
		SQLStore:       store,
		SecretsStore:   secretsStore,
		SecretsService: secretsService,
		ptc: proxyTransportCache{
			cache: make(map[int64]cachedRoundTripper),
		},
		cfg:                cfg,
		features:           features,
		permissionsService: datasourcePermissionsService,
		ac:                 ac,
		logger:             dslogger,
		db:                 db,
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

func (s *Service) GetDataSourcesByType(ctx context.Context, query *datasources.GetDataSourcesByTypeQuery) ([]*datasources.DataSource, error) {
	return s.SQLStore.GetDataSourcesByType(ctx, query)
}

func (s *Service) AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) (*datasources.DataSource, error) {
	var dataSource *datasources.DataSource

	return dataSource, s.db.InTransaction(ctx, func(ctx context.Context) error {
		var err error

		cmd.EncryptedSecureJsonData = make(map[string][]byte)
		if !s.features.IsEnabled(featuremgmt.FlagDisableSecretsCompatibility) {
			cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
			if err != nil {
				return err
			}
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

		if !s.ac.IsDisabled() {
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
				permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{UserID: cmd.UserID, Permission: "Edit"})
			}
			if _, err := s.permissionsService.SetPermissions(ctx, cmd.OrgID, dataSource.UID, permissions...); err != nil {
				return err
			}
		}

		return nil
	})
}

func (s *Service) DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error {
	return s.db.InTransaction(ctx, func(ctx context.Context) error {
		cmd.UpdateSecretFn = func() error {
			return s.SecretsStore.Del(ctx, cmd.OrgID, cmd.Name, kvstore.DataSourceSecretType)
		}

		return s.SQLStore.DeleteDataSource(ctx, cmd)
	})
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

func (s *Service) GetDefaultDataSource(ctx context.Context, query *datasources.GetDefaultDataSourceQuery) (*datasources.DataSource, error) {
	return s.SQLStore.GetDefaultDataSource(ctx, query)
}

func (s *Service) GetHTTPClient(ctx context.Context, ds *datasources.DataSource, provider httpclient.Provider) (*http.Client, error) {
	transport, err := s.GetHTTPTransport(ctx, ds, provider)
	if err != nil {
		return nil, err
	}

	return &http.Client{
		Timeout:   s.getTimeout(ds),
		Transport: transport,
	}, nil
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

func (s *Service) GetTLSConfig(ctx context.Context, ds *datasources.DataSource, httpClientProvider httpclient.Provider) (*tls.Config, error) {
	opts, err := s.httpClientOptions(ctx, ds)
	if err != nil {
		return nil, err
	}
	return httpClientProvider.GetTLSConfig(*opts)
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
			s.logger.Debug("failed to unmarshal secret value, using legacy secrets", "err", err)
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
		Headers:  s.getCustomHeaders(ds.JsonData, decryptedValues),
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
		deepJsonDataCopy := make(map[string]interface{}, len(opts.CustomOptions))
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

	if ds.JsonData != nil && ds.JsonData.Get("sigV4Auth").MustBool(false) && setting.SigV4AuthEnabled {
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
				fmt.Print("\n\n\n\n", val, exists, err, "\n\n\n\n")
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
func (s *Service) getCustomHeaders(jsonData *simplejson.Json, decryptedValues map[string]string) map[string]string {
	headers := make(map[string]string)
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
		if s.cfg.AuthProxyEnabled && http.CanonicalHeaderKey(key) == http.CanonicalHeaderKey(s.cfg.AuthProxyHeaderName) {
			continue
		}

		if val, ok := decryptedValues[headerValueSuffix]; ok {
			headers[key] = val
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
	case datasources.DS_PROMETHEUS, datasources.DS_ALERTMANAGER:
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

	for k, v := range decrypted {
		if _, ok := cmd.SecureJsonData[k]; !ok {
			cmd.SecureJsonData[k] = v
		}
	}

	cmd.EncryptedSecureJsonData = make(map[string][]byte)
	if !s.features.IsEnabled(featuremgmt.FlagDisableSecretsCompatibility) {
		cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
		if err != nil {
			return err
		}
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
func (s *Service) CustomHeaders(ctx context.Context, ds *datasources.DataSource) (map[string]string, error) {
	values, err := s.SecretsService.DecryptJsonData(ctx, ds.SecureJsonData)
	if err != nil {
		return nil, fmt.Errorf("failed to get custom headers: %w", err)
	}
	return s.getCustomHeaders(ds.JsonData, values), nil
}
