package resource

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"strings"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var tenantGVR = schema.GroupVersionResource{
	Group:    "cloud.grafana.com",
	Version:  "v1alpha1",
	Resource: "tenants",
}

const (
	labelPendingDelete           = "cloud.grafana.com/pending-delete"
	annotationPendingDeleteAfter = "cloud.grafana.com/pending-delete-after"
)

// TenantWatcher watches Tenant CRDs via a Kubernetes informer and syncs
// pending-delete state to the KV store.
type TenantWatcher struct {
	log    log.Logger
	kv     KV
	ctx    context.Context
	stopCh chan struct{}
}

// TenantWatcherConfig holds configuration for the TenantWatcher.
type TenantWatcherConfig struct {
	// TenantAPIServerURL is the URL of the app-platform API server serving Tenant CRDs.
	TenantAPIServerURL string
	// Token is the system token used to sign access tokens.
	Token string
	// TokenExchangeURL is the URL used to exchange the system token for an access token.
	TokenExchangeURL string
	// AllowInsecure skips TLS verification (for local dev).
	AllowInsecure bool
	// ResyncInterval is how often the informer re-lists all tenants.
	ResyncInterval time.Duration
	Log            log.Logger
}

// NewTenantWatcherConfig creates TenantWatcherConfig from Grafana settings and returns nil
// when required settings are missing.
func NewTenantWatcherConfig(cfg *setting.Cfg) *TenantWatcherConfig {
	logger := log.New("tenant-watcher")
	if logger == nil {
		logger = log.NewNopLogger()
	}

	if cfg == nil {
		logger.Info("tenant watcher not initialized, config is nil")
		return nil
	}

	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	tenantWatcherCfg := &TenantWatcherConfig{
		TenantAPIServerURL: strings.TrimSpace(cfg.TenantApiServerAddress),
		Token:              strings.TrimSpace(grpcSection.Key("token").MustString("")),
		TokenExchangeURL:   strings.TrimSpace(grpcSection.Key("token_exchange_url").MustString("")),
		AllowInsecure:      cfg.TenantWatcherAllowInsecureTLS,
		Log:                logger,
	}

	if tenantWatcherCfg.TenantAPIServerURL == "" || tenantWatcherCfg.Token == "" || tenantWatcherCfg.TokenExchangeURL == "" {
		logger.Warn("tenant watcher not valid - ensure tenant api address, token, and token exchange url are set")
		return nil
	}

	return tenantWatcherCfg
}

// NewTenantRESTConfig creates a rest.Config that authenticates to the
// app-platform API server using a signed access token sent via the
// Authorization header.
func NewTenantRESTConfig(cfg TenantWatcherConfig) (*rest.Config, error) {
	var exchangeOpts []authnlib.ExchangeClientOpts
	if cfg.AllowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(
			&http.Client{Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec
			}},
		))
	}

	tc, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            cfg.Token,
		TokenExchangeURL: cfg.TokenExchangeURL,
	}, exchangeOpts...)
	if err != nil {
		return nil, fmt.Errorf("creating token exchange client: %w", err)
	}

	// Exchange the system token for an access token scoped to cloud.grafana.com.
	tokenResp, err := tc.Exchange(context.Background(), authnlib.TokenExchangeRequest{
		Namespace: "*",
		Audiences: []string{"cloud.grafana.com"},
	})
	if err != nil {
		return nil, fmt.Errorf("exchanging token: %w", err)
	}

	restCfg := &rest.Config{
		Host:        cfg.TenantAPIServerURL,
		BearerToken: tokenResp.Token,
	}

	if cfg.AllowInsecure {
		restCfg.TLSClientConfig = rest.TLSClientConfig{
			Insecure: true,
		}
	}

	return restCfg, nil
}

// NewTenantWatcher creates and starts a TenantWatcher.
func NewTenantWatcher(ctx context.Context, kv KV, writeEvent EventAppender, cfg TenantWatcherConfig) (*TenantWatcher, error) {
	restCfg, err := NewTenantRESTConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("building tenant REST config: %w", err)
	}

	logger := cfg.Log
	if logger == nil {
		logger = log.NewNopLogger()
	}

	resync := cfg.ResyncInterval
	if resync <= 0 {
		resync = 60 * time.Minute
	}

	client, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("creating dynamic client: %w", err)
	}

	tw := &TenantWatcher{
		log:    logger,
		kv:     kv,
		ctx:    ctx,
		stopCh: make(chan struct{}),
	}

	factory := dynamicinformer.NewDynamicSharedInformerFactory(client, resync)
	informer := factory.ForResource(tenantGVR).Informer()

	_, err = informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			tw.handleTenant(obj.(*unstructured.Unstructured))
		},
		UpdateFunc: func(_, newObj interface{}) {
			tw.handleTenant(newObj.(*unstructured.Unstructured))
		},
	})
	if err != nil {
		return nil, err
	}

	factory.Start(tw.stopCh)
	logger.Info("tenant watcher started")

	return tw, nil
}

// Stop stops the tenant watcher.
func (tw *TenantWatcher) Stop() {
	close(tw.stopCh)
}

func (tw *TenantWatcher) handleTenant(tenant *unstructured.Unstructured) {
	name := tenant.GetName()
	labels := tenant.GetLabels()

	if labels[labelPendingDelete] == "true" {
		deleteAfter, ok := tenant.GetAnnotations()[annotationPendingDeleteAfter]
		if !ok {
			tw.log.Warn("tenant marked pending-delete but missing delete-after annotation", "tenant", name)
			return
		}
		tw.markPendingDelete(name, deleteAfter)
	} else {
		tw.clearPendingDelete(name)
	}
}

// markPendingDelete records that a tenant is pending deletion in the KV store.
func (tw *TenantWatcher) markPendingDelete(name string, deleteAfter string) {
	// TODO
	// Save a pending delete record to the KV store.
	tw.log.Info("marking tenant pending delete", "tenant", name, "delete_after", deleteAfter)
}

/*
func (tw *TenantWatcher) markResourcesPendingDelete() {
	// TODO
	// 1. List all resources for the tenant from the kv datastore
	// 2. For each resource add a pending delete label to it using the write callback function
	// 3. When completed, store something either in the kv store or write it to the tenant on the tenant apiserver
	tw.log.Info("marking tenant resources pending delete")
}
*/

// clearPendingDelete removes the pending-delete record for a tenant from the KV store, if one exists, and unmarks all resources for the tenant as pending delete.
func (tw *TenantWatcher) clearPendingDelete(name string) {
	// TODO
	// Remove the pending delete record from the KV store.
	tw.log.Info("clearing tenant pending delete", "tenant", name)
}
