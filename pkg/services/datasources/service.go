package datasources

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
)

type Service struct {
	Bus            bus.Bus
	SQLStore       *sqlstore.SQLStore
	SecretsService secrets.Service

	ptc               proxyTransportCache
	dsDecryptionCache secureJSONDecryptionCache
}

type proxyTransportCache struct {
	cache map[int64]cachedRoundTripper
	sync.Mutex
}

type cachedRoundTripper struct {
	updated      time.Time
	roundTripper http.RoundTripper
}

type secureJSONDecryptionCache struct {
	cache map[int64]cachedDecryptedJSON
	sync.Mutex
}

type cachedDecryptedJSON struct {
	updated time.Time
	json    map[string]string
}

func ProvideService(bus bus.Bus, store *sqlstore.SQLStore, secretsService secrets.Service, ac accesscontrol.AccessControl) *Service {
	s := &Service{
		Bus:            bus,
		SQLStore:       store,
		SecretsService: secretsService,
		ptc: proxyTransportCache{
			cache: make(map[int64]cachedRoundTripper),
		},
		dsDecryptionCache: secureJSONDecryptionCache{
			cache: make(map[int64]cachedDecryptedJSON),
		},
	}

	s.Bus.AddHandler(s.GetDataSources)
	s.Bus.AddHandler(s.GetDataSourcesByType)
	s.Bus.AddHandler(s.GetDataSource)
	s.Bus.AddHandler(s.AddDataSource)
	s.Bus.AddHandler(s.DeleteDataSource)
	s.Bus.AddHandler(s.UpdateDataSource)
	s.Bus.AddHandler(s.GetDefaultDataSource)

	ac.RegisterAttributeScopeResolver(NewNameScopeResolver(store))

	return s
}

type DataSourceRetriever interface {
	GetDataSource(ctx context.Context, query *models.GetDataSourceQuery) error
}

// NewNameScopeResolver provides an AttributeScopeResolver able to
// translate a scope prefixed with "datasources:name:" into an id based scope.
func NewNameScopeResolver(db DataSourceRetriever) (string, accesscontrol.AttributeScopeResolveFunc) {
	dsNameResolver := func(ctx context.Context, orgID int64, initialScope string) (string, error) {
		dsNames := strings.Split(initialScope, ":")
		if dsNames[0] != "datasources" || len(dsNames) != 3 {
			return "", accesscontrol.ErrInvalidScope
		}

		dsName := dsNames[2]
		// Special wildcard case
		if dsName == "*" {
			return accesscontrol.Scope("datasources", "id", "*"), nil
		}

		query := models.GetDataSourceQuery{Name: dsName, OrgId: orgID}
		if err := db.GetDataSource(ctx, &query); err != nil {
			return "", err
		}

		return accesscontrol.Scope("datasources", "id", fmt.Sprintf("%v", query.Result.Id)), nil
	}

	return "datasources:name:", dsNameResolver
}

func (s *Service) GetDataSource(ctx context.Context, query *models.GetDataSourceQuery) error {
	return s.SQLStore.GetDataSource(ctx, query)
}

func (s *Service) GetDataSources(ctx context.Context, query *models.GetDataSourcesQuery) error {
	return s.SQLStore.GetDataSources(ctx, query)
}

func (s *Service) GetDataSourcesByType(ctx context.Context, query *models.GetDataSourcesByTypeQuery) error {
	return s.SQLStore.GetDataSourcesByType(ctx, query)
}

func (s *Service) AddDataSource(ctx context.Context, cmd *models.AddDataSourceCommand) error {
	var err error
	cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.SQLStore.AddDataSource(ctx, cmd)
}

func (s *Service) DeleteDataSource(ctx context.Context, cmd *models.DeleteDataSourceCommand) error {
	return s.SQLStore.DeleteDataSource(ctx, cmd)
}

func (s *Service) UpdateDataSource(ctx context.Context, cmd *models.UpdateDataSourceCommand) error {
	var err error
	cmd.EncryptedSecureJsonData, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureJsonData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.SQLStore.UpdateDataSource(ctx, cmd)
}

func (s *Service) GetDefaultDataSource(ctx context.Context, query *models.GetDefaultDataSourceQuery) error {
	return s.SQLStore.GetDefaultDataSource(ctx, query)
}

func (s *Service) GetHTTPClient(ds *models.DataSource, provider httpclient.Provider) (*http.Client, error) {
	transport, err := s.GetHTTPTransport(ds, provider)
	if err != nil {
		return nil, err
	}

	return &http.Client{
		Timeout:   s.getTimeout(ds),
		Transport: transport,
	}, nil
}

func (s *Service) GetHTTPTransport(ds *models.DataSource, provider httpclient.Provider,
	customMiddlewares ...sdkhttpclient.Middleware) (http.RoundTripper, error) {
	s.ptc.Lock()
	defer s.ptc.Unlock()

	if t, present := s.ptc.cache[ds.Id]; present && ds.Updated.Equal(t.updated) {
		return t.roundTripper, nil
	}

	opts, err := s.httpClientOptions(ds)
	if err != nil {
		return nil, err
	}

	opts.Middlewares = customMiddlewares

	rt, err := provider.GetTransport(*opts)
	if err != nil {
		return nil, err
	}

	s.ptc.cache[ds.Id] = cachedRoundTripper{
		roundTripper: rt,
		updated:      ds.Updated,
	}

	return rt, nil
}

func (s *Service) GetTLSConfig(ds *models.DataSource, httpClientProvider httpclient.Provider) (*tls.Config, error) {
	opts, err := s.httpClientOptions(ds)
	if err != nil {
		return nil, err
	}
	return httpClientProvider.GetTLSConfig(*opts)
}

func (s *Service) DecryptedValues(ds *models.DataSource) map[string]string {
	s.dsDecryptionCache.Lock()
	defer s.dsDecryptionCache.Unlock()

	if item, present := s.dsDecryptionCache.cache[ds.Id]; present && ds.Updated.Equal(item.updated) {
		return item.json
	}

	json, err := s.SecretsService.DecryptJsonData(context.Background(), ds.SecureJsonData)
	if err != nil {
		return map[string]string{}
	}

	s.dsDecryptionCache.cache[ds.Id] = cachedDecryptedJSON{
		updated: ds.Updated,
		json:    json,
	}

	return json
}

func (s *Service) DecryptedValue(ds *models.DataSource, key string) (string, bool) {
	value, exists := s.DecryptedValues(ds)[key]
	return value, exists
}

func (s *Service) DecryptedBasicAuthPassword(ds *models.DataSource) string {
	if value, ok := s.DecryptedValue(ds, "basicAuthPassword"); ok {
		return value
	}

	return ds.BasicAuthPassword
}

func (s *Service) DecryptedPassword(ds *models.DataSource) string {
	if value, ok := s.DecryptedValue(ds, "password"); ok {
		return value
	}

	return ds.Password
}

func (s *Service) httpClientOptions(ds *models.DataSource) (*sdkhttpclient.Options, error) {
	tlsOptions := s.dsTLSOptions(ds)
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
	opts := &sdkhttpclient.Options{
		Timeouts: timeouts,
		Headers:  s.getCustomHeaders(ds.JsonData, s.DecryptedValues(ds)),
		Labels: map[string]string{
			"datasource_name": ds.Name,
			"datasource_uid":  ds.Uid,
		},
		TLS: &tlsOptions,
	}

	if ds.JsonData != nil {
		opts.CustomOptions = ds.JsonData.MustMap()
	}

	if ds.BasicAuth {
		opts.BasicAuth = &sdkhttpclient.BasicAuthOptions{
			User:     ds.BasicAuthUser,
			Password: s.DecryptedBasicAuthPassword(ds),
		}
	} else if ds.User != "" {
		opts.BasicAuth = &sdkhttpclient.BasicAuthOptions{
			User:     ds.User,
			Password: s.DecryptedPassword(ds),
		}
	}

	if ds.JsonData != nil && ds.JsonData.Get("azureAuth").MustBool() {
		credentials, err := azcredentials.FromDatasourceData(ds.JsonData.MustMap(), s.DecryptedValues(ds))
		if err != nil {
			err = fmt.Errorf("invalid Azure credentials: %s", err)
			return nil, err
		}

		opts.CustomOptions["_azureAuth"] = true
		if credentials != nil {
			opts.CustomOptions["_azureCredentials"] = credentials
		}
	}

	if ds.JsonData != nil && ds.JsonData.Get("sigV4Auth").MustBool(false) && setting.SigV4AuthEnabled {
		opts.SigV4 = &sdkhttpclient.SigV4Config{
			Service:       awsServiceNamespace(ds.Type),
			Region:        ds.JsonData.Get("sigV4Region").MustString(),
			AssumeRoleARN: ds.JsonData.Get("sigV4AssumeRoleArn").MustString(),
			AuthType:      ds.JsonData.Get("sigV4AuthType").MustString(),
			ExternalID:    ds.JsonData.Get("sigV4ExternalId").MustString(),
			Profile:       ds.JsonData.Get("sigV4Profile").MustString(),
		}

		if val, exists := s.DecryptedValue(ds, "sigV4AccessKey"); exists {
			opts.SigV4.AccessKey = val
		}

		if val, exists := s.DecryptedValue(ds, "sigV4SecretKey"); exists {
			opts.SigV4.SecretKey = val
		}
	}

	return opts, nil
}

func (s *Service) dsTLSOptions(ds *models.DataSource) sdkhttpclient.TLSOptions {
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
			if val, exists := s.DecryptedValue(ds, "tlsCACert"); exists && len(val) > 0 {
				opts.CACertificate = val
			}
		}

		if tlsClientAuth {
			if val, exists := s.DecryptedValue(ds, "tlsClientCert"); exists && len(val) > 0 {
				opts.ClientCertificate = val
			}
			if val, exists := s.DecryptedValue(ds, "tlsClientKey"); exists && len(val) > 0 {
				opts.ClientKey = val
			}
		}
	}

	return opts
}

func (s *Service) getTimeout(ds *models.DataSource) time.Duration {
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

	index := 1
	for {
		headerNameSuffix := fmt.Sprintf("httpHeaderName%d", index)
		headerValueSuffix := fmt.Sprintf("httpHeaderValue%d", index)

		key := jsonData.Get(headerNameSuffix).MustString()
		if key == "" {
			// No (more) header values are available
			break
		}

		if val, ok := decryptedValues[headerValueSuffix]; ok {
			headers[key] = val
		}
		index++
	}

	return headers
}

func awsServiceNamespace(dsType string) string {
	switch dsType {
	case models.DS_ES, models.DS_ES_OPEN_DISTRO, models.DS_ES_OPENSEARCH:
		return "es"
	case models.DS_PROMETHEUS:
		return "aps"
	default:
		panic(fmt.Sprintf("Unsupported datasource %q", dsType))
	}
}
