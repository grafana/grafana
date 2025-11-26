package resource

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/grafana/dskit/runtimeconfig"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.yaml.in/yaml/v3"
)

const DEFAULT_RESOURCE_LIMIT = 1000

type OverridesService struct {
	manager *runtimeconfig.Manager
	logger  log.Logger
	tracer  trace.Tracer
}

type ReloadOptions struct {
	FilePath     string
	ReloadPeriod time.Duration
}

// ResourceQuota represents quota limits for a specific resource
type ResourceQuota struct {
	Limit int `yaml:"limit"`
}

// TenantOverrides represents all overrides for a tenant
type TenantOverrides struct {
	Quotas map[string]ResourceQuota `yaml:"quotas"`
}

// Overrides represents the entire overrides configuration file
type Overrides struct {
	Tenants map[string]TenantOverrides
}

/*
This service loads overrides (currently just quotas) from a YAML file with the following yaml structure:

"123":

	  quotas:
		grafana.dashboard.app/dashboards:
		  limit: 1500
		grafana.folder.app/folders:
		  limit: 1500
*/
func NewOverridesService(ctx context.Context, logger log.Logger, reg prometheus.Registerer, tracer trace.Tracer, opts ReloadOptions) (*OverridesService, error) {
	// shouldn't be empty since we use file path existence to determine if we should enable the service
	if opts.FilePath == "" {
		return nil, fmt.Errorf("overrides file path is required")
	}
	if opts.ReloadPeriod == 0 {
		opts.ReloadPeriod = time.Second * 30
	}

	// Check if file exists
	if _, err := os.Stat(opts.FilePath); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("overrides file does not exist: %s", opts.FilePath)
		}
		return nil, fmt.Errorf("failed to stat overrides file: %w", err)
	}

	config := runtimeconfig.Config{
		ReloadPeriod: opts.ReloadPeriod,
		LoadPath:     []string{opts.FilePath},
		Loader: func(r io.Reader) (interface{}, error) {
			var tenants map[string]TenantOverrides
			decoder := yaml.NewDecoder(r)
			if err := decoder.Decode(&tenants); err != nil {
				return nil, err
			}
			return &Overrides{Tenants: tenants}, nil
		},
	}

	manager, err := runtimeconfig.New(config, "tenant-overrides", reg, logger)
	if err != nil {
		return nil, err
	}

	return &OverridesService{
		manager: manager,
		logger:  logger.FromContext(ctx),
		tracer:  tracer,
	}, nil
}

func (q *OverridesService) init(ctx context.Context) error {
	return services.StartAndAwaitRunning(ctx, q.manager)
}

func (q *OverridesService) stop() {
	q.manager.StopAsync()
}

func (q *OverridesService) GetQuota(ctx context.Context, nsr NamespacedResource) (ResourceQuota, error) {
	_, span := q.tracer.Start(ctx, "OverridesService.GetQuota", trace.WithAttributes(
		attribute.String("namespace", nsr.Namespace),
		attribute.String("group", nsr.Group),
		attribute.String("resource", nsr.Resource),
	))
	defer span.End()

	if nsr.Namespace == "" || nsr.Resource == "" || nsr.Group == "" {
		return ResourceQuota{}, fmt.Errorf("invalid namespaced resource: %+v", nsr)
	}

	overrides, ok := q.manager.GetConfig().(*Overrides)
	if !ok {
		return ResourceQuota{}, fmt.Errorf("failed to get quota overrides from config manager")
	}

	tenantId := strings.TrimPrefix(nsr.Namespace, "stacks-")
	groupResource := nsr.Group + "/" + nsr.Resource
	if tenantOverrides, ok := overrides.Tenants[tenantId]; ok {
		if resourceQuota, ok := tenantOverrides.Quotas[groupResource]; ok {
			return resourceQuota, nil
		}
	}

	return ResourceQuota{Limit: DEFAULT_RESOURCE_LIMIT}, nil
}
