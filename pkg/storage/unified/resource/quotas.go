package resource

import (
	"io"
	"sync"
	"time"

	"github.com/grafana/dskit/runtimeconfig"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/net/context"
	"gopkg.in/yaml.v3"
)

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
		dashboards:
		  limit: 1500
		folders:
		  limit: 1500
*/
func NewQuotaService(ctx context.Context, opts ReloadOptions) (*QuotaService, error) {
	if opts.FilePath == "" {
		opts.FilePath = "overrides.yaml"
	}
	if opts.ReloadPeriod == 0 {
		opts.ReloadPeriod = time.Second * 5
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

	// TODO pass in prom reg
	manager, err := runtimeconfig.New(config, "custom-quotas", prometheus.NewRegistry(), log.New())
	if err != nil {
		return nil, err
	}

	return &QuotaService{
		manager: manager,
		logger:  log.New(),
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

// TODO: This will always return true until we start tracking resource counts
// but we can at least log the custom quota limits per namespace/resource for now
func (q *QuotaService) ValidateQuota(namespace string, resource string) bool {
	overrides := q.GetConfig()
	if overrides == nil {
		return true
	}

	tenantQuotas, ok := overrides.Tenants[namespace]
	if !ok {
		return true
	}

	resQuota, ok := tenantQuotas.Quotas[resource]
	if !ok {
		return true
	}

	q.logger.Info("Validating quota", "namespace", namespace, "resource", resource, "limit", resQuota.Limit)
	return true
}
