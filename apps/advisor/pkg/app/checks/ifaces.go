package checks

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// Check returns metadata about the check being executed and the list of Steps
type Check interface {
	// ID returns the unique identifier of the check
	ID() string
	// Name returns the human-readable name of the check
	Name() string
	// Item returns the item that will be checked
	Item(ctx context.Context, id string) (any, error)
	// Items returns the list of items that will be checked
	Items(ctx context.Context) ([]any, error)
	// Steps returns the list of steps that will be executed
	Steps() []Step
	// Init initializes the check. It's called before running the steps and should be idempotent.
	// The result should not be cached, it should be initialized from scratch.
	Init(ctx context.Context) error
}

// Step is a single step in a check, including its metadata
type Step interface {
	// ID returns the unique identifier of the step
	ID() string
	// Title returns the title of the step
	Title() string
	// Description returns the description of the step
	Description() string
	// Explains the action that needs to be taken to resolve the issue
	Resolution() string
	// Run executes the step for an item and returns a report
	Run(ctx context.Context, log logging.Logger, obj *advisorv0alpha1.CheckSpec, item any) ([]advisorv0alpha1.CheckReportFailure, error)
}

// PluginInfoGetter is a minimal interface for retrieving plugin information from a repository.
// It contains only the GetPluginsInfo method used by plugincheck and datasourcecheck.
type PluginInfoGetter interface {
	// GetPluginsInfo will return a list of plugins from grafana.com/api/plugins.
	GetPluginsInfo(ctx context.Context, options repo.GetPluginsInfoOptions, compatOpts repo.CompatOpts) ([]repo.PluginInfo, error)
}

// DataSourceGetter is a minimal interface for retrieving datasource information.
// It contains only the GetDataSources and GetDataSource methods used by datasourcecheck.
type DataSourceGetter interface {
	// GetDataSources gets datasources.
	GetDataSources(ctx context.Context, query *datasources.GetDataSourcesQuery) ([]*datasources.DataSource, error)
	// GetDataSource gets a datasource.
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error)
}

// HealthChecker is a generic interface for checking data source health.
// It receives minimal input (context and datasource) and returns the health check result.
type HealthChecker interface {
	CheckHealth(ctx context.Context, ds *datasources.DataSource) (*backend.CheckHealthResult, error)
}
