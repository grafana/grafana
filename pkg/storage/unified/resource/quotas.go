package resource

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/grafana/dskit/runtimeconfig"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"go.yaml.in/yaml/v3"
)

const DEFAULT_RESOURCE_LIMIT = 1000

type ValidatesQuotas interface {
	ValidateQuota(namespace string, resource string) bool
}

type QuotaService struct {
	manager        *runtimeconfig.Manager
	quotaOverrides *QuotaOverrides
	overridesMutex sync.RWMutex
	logger         log.Logger // TODO: which logger do we use now? Slog? Or infra.log?
}

type ReloadOptions struct {
	FilePath     string
	ReloadPeriod time.Duration
}

// ResourceQuota represents quota limits for a specific resource
type ResourceQuota struct {
	Limit int `yaml:"limit"`
}

// TenantQuotas represents all quotas for a tenant
type TenantQuotas struct {
	Quotas map[string]ResourceQuota `yaml:"quotas"`
}

// QuotaOverrides represents the entire quota configuration file
type QuotaOverrides struct {
	Tenants map[string]TenantQuotas
}

/*
This service loads quota overrides from a YAML file with the following yaml structure:

"stacks-123":

	  quotas:
		grafana.dashboard.app/dashboards:
		  limit: 1500
		grafana.folder.app/folders:
		  limit: 1500
*/
func NewQuotaService(ctx context.Context, logger log.Logger, reg prometheus.Registerer, opts ReloadOptions) (*QuotaService, error) {
	// shouldn't be empty since we use file path existence to determine if we should enable the service
	if opts.FilePath == "" {
		return nil, fmt.Errorf("quota overrides file path is required")
	}
	if opts.ReloadPeriod == 0 {
		opts.ReloadPeriod = time.Second * 30
	}

	// Check if file exists
	if _, err := os.Stat(opts.FilePath); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("quota overrides file does not exist: %s", opts.FilePath)
		}
		return nil, fmt.Errorf("failed to stat quota overrides file: %w", err)
	}

	config := runtimeconfig.Config{
		ReloadPeriod: opts.ReloadPeriod,
		LoadPath:     []string{opts.FilePath},
		Loader: func(r io.Reader) (interface{}, error) {
			var tenants map[string]TenantQuotas
			decoder := yaml.NewDecoder(r)
			if err := decoder.Decode(&tenants); err != nil {
				return nil, err
			}
			return &QuotaOverrides{Tenants: tenants}, nil
		},
	}

	manager, err := runtimeconfig.New(config, "custom-quotas", reg, logger)
	if err != nil {
		return nil, err
	}

	return &QuotaService{
		manager: manager,
		logger:  logger,
	}, nil
}

// one the runtimeconfig manager is in a running state, it will periodically reload the configuration file into the manager if there are changes
func (q *QuotaService) init(ctx context.Context) error {
	err := q.manager.StartAsync(ctx)
	if err != nil {
		return err
	}
	err = q.manager.AwaitRunning(ctx)
	if err != nil {
		return err
	}

	// set initial config once running
	q.SetConfig(q.manager.GetConfig().(*QuotaOverrides))

	// update config on changes
	updateChannel := q.manager.CreateListenerChannel(1)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case update := <-updateChannel:
				q.logger.Info("Received quota config update", "update", update)
				newConfig, ok := update.(*QuotaOverrides)
				if !ok {
					q.logger.Error("Failed to convert quota config update to QuotaOverrides", "update", update)
					continue
				}
				q.SetConfig(newConfig)
			}
		}
	}()

	return nil
}

func (q *QuotaService) stop() {
	q.manager.StopAsync()
}

func (q *QuotaService) GetConfig() *QuotaOverrides {
	q.overridesMutex.Lock()
	defer q.overridesMutex.Unlock()
	return q.quotaOverrides
}

func (q *QuotaService) SetConfig(overrides *QuotaOverrides) {
	q.overridesMutex.Lock()
	q.quotaOverrides = overrides
	q.overridesMutex.Unlock()
}

func (q *QuotaService) GetQuota(nsr NamespacedResource) (ResourceQuota, error) {
	if nsr.Namespace == "" || nsr.Resource == "" || nsr.Group == "" {
		return ResourceQuota{}, fmt.Errorf("invalid namespaced resource: %+v", nsr)
	}

	overrides := q.GetConfig()
	// should never be nil - but just in case
	if overrides == nil {
		return ResourceQuota{Limit: DEFAULT_RESOURCE_LIMIT}, nil
	}

	tenantId := strings.TrimPrefix(nsr.Namespace, "stacks-")
	groupResource := nsr.Group + "/" + nsr.Resource
	if tenantQuotas, ok := overrides.Tenants[tenantId]; ok {
		if resourceQuota, ok := tenantQuotas.Quotas[groupResource]; ok {
			return resourceQuota, nil
		}
	}

	return ResourceQuota{Limit: DEFAULT_RESOURCE_LIMIT}, nil
}
