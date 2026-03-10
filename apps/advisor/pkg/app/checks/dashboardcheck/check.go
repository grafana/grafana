package dashboardcheck

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
)

const (
	CheckID = "dashboard"
)

// DashboardGetter is a minimal interface for retrieving dashboard information.
type DashboardGetter interface {
	GetAllDashboardsByOrgId(ctx context.Context, orgID int64) ([]*dashboards.Dashboard, error)
	GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error)
}

type check struct {
	DashboardSvc   DashboardGetter
	DatasourceSvc  checks.DataSourceGetter
	datasourceUIDs *map[string]bool
	datasourceMu   *sync.RWMutex
}

// New returns a Check that lists dashboards and validates their datasource references.
func New(
	dashboardSvc DashboardGetter,
	datasourceSvc checks.DataSourceGetter,
) checks.Check {
	m := make(map[string]bool)
	mu := &sync.RWMutex{}
	return &check{
		DashboardSvc:   dashboardSvc,
		DatasourceSvc:  datasourceSvc,
		datasourceUIDs: &m,
		datasourceMu:   mu,
	}
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Name() string {
	return "dashboard"
}

func (c *check) Init(ctx context.Context) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	dss, err := c.DatasourceSvc.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
		OrgID: requester.GetOrgID(),
	})
	if err != nil {
		return err
	}
	c.datasourceMu.Lock()
	defer c.datasourceMu.Unlock()
	m := make(map[string]bool)
	for _, ds := range dss {
		m[ds.UID] = true
	}
	*c.datasourceUIDs = m
	return nil
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	dashes, err := c.DashboardSvc.GetAllDashboardsByOrgId(ctx, requester.GetOrgID())
	if err != nil {
		return nil, err
	}
	var res []any
	for _, d := range dashes {
		if d.IsFolder {
			continue
		}
		res = append(res, d)
	}
	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	dash, err := c.DashboardSvc.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:   id,
		OrgID: requester.GetOrgID(),
	})
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if dash.IsFolder {
		return nil, nil
	}
	return dash, nil
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&missingDatasourceStep{datasourceUIDs: c.datasourceUIDs, datasourceMu: c.datasourceMu},
	}
}
