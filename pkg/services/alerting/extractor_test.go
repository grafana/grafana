package alerting

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/permissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAlertRuleExtraction(t *testing.T) {
	RegisterCondition("query", func(model *simplejson.Json, index int) (Condition, error) {
		return &FakeCondition{}, nil
	})

	// mock data
	defaultDs := &datasources.DataSource{ID: 12, OrgID: 1, Name: "I am default", IsDefault: true, UID: "def-uid"}
	graphite2Ds := &datasources.DataSource{ID: 15, OrgID: 1, Name: "graphite2", UID: "graphite2-uid"}

	json, err := os.ReadFile("./testdata/graphite-alert.json")
	require.Nil(t, err)

	dsPermissions := permissions.NewMockDatasourcePermissionService()
	dsPermissions.DsResult = []*datasources.DataSource{
		{
			ID: 1,
		},
	}

	dsService := &fakeDatasourceService{ExpectedDatasource: defaultDs}
	db := dbtest.NewFakeDB()
	cfg := &setting.Cfg{}
	store := ProvideAlertStore(db, localcache.ProvideService(), cfg, tagimpl.ProvideService(db, cfg), featuremgmt.WithFeatures())
	extractor := ProvideDashAlertExtractorService(dsPermissions, dsService, store)

	t.Run("Parsing alert rules from dashboard json", func(t *testing.T) {
		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		getTarget := func(j *simplejson.Json) string {
			rowObj := j.Get("rows").MustArray()[0]
			row := simplejson.NewFromAny(rowObj)
			panelObj := row.Get("panels").MustArray()[0]
			panel := simplejson.NewFromAny(panelObj)
			conditionObj := panel.Get("alert").Get("conditions").MustArray()[0]
			condition := simplejson.NewFromAny(conditionObj)
			return condition.Get("query").Get("model").Get("target").MustString()
		}

		require.Equal(t, getTarget(dashJSON), "")

		_, _ = extractor.GetAlerts(context.Background(), DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		})

		require.Equal(t, getTarget(dashJSON), "")
	})

	t.Run("Parsing and validating dashboard containing graphite alerts", func(t *testing.T) {
		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		dsService.ExpectedDatasource = &datasources.DataSource{ID: 12}
		alerts, err := extractor.GetAlerts(context.Background(), DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		})

		require.Nil(t, err)

		require.Len(t, alerts, 2)

		for _, v := range alerts {
			require.EqualValues(t, v.DashboardID, 57)
			require.NotEmpty(t, v.Name)
			require.NotEmpty(t, v.Message)

			settings := simplejson.NewFromAny(v.Settings)
			require.Equal(t, settings.Get("interval").MustString(""), "")
		}

		require.EqualValues(t, alerts[0].Handler, 1)
		require.EqualValues(t, alerts[1].Handler, 0)

		require.EqualValues(t, alerts[0].Frequency, 60)
		require.EqualValues(t, alerts[1].Frequency, 60)

		require.EqualValues(t, alerts[0].PanelID, 3)
		require.EqualValues(t, alerts[1].PanelID, 4)

		require.Equal(t, alerts[0].For, time.Minute*2)
		require.Equal(t, alerts[1].For, time.Duration(0))

		require.Equal(t, alerts[0].Name, "name1")
		require.Equal(t, alerts[0].Message, "desc1")
		require.Equal(t, alerts[1].Name, "name2")
		require.Equal(t, alerts[1].Message, "desc2")

		condition := simplejson.NewFromAny(alerts[0].Settings.Get("conditions").MustArray()[0])
		query := condition.Get("query")
		require.EqualValues(t, query.Get("datasourceId").MustInt64(), 12)

		condition = simplejson.NewFromAny(alerts[0].Settings.Get("conditions").MustArray()[0])
		model := condition.Get("query").Get("model")
		require.Equal(t, model.Get("target").MustString(), "aliasByNode(statsd.fakesite.counters.session_start.desktop.count, 4)")
	})

	t.Run("Panels missing id should return error", func(t *testing.T) {
		panelWithoutID, err := os.ReadFile("./testdata/panels-missing-id.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(panelWithoutID)
		require.Nil(t, err)

		_, err = extractor.GetAlerts(context.Background(), DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		})

		require.NotNil(t, err)
	})

	t.Run("Panels missing id should return error", func(t *testing.T) {
		panelWithIDZero, err := os.ReadFile("./testdata/panel-with-id-0.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(panelWithIDZero)
		require.Nil(t, err)

		_, err = extractor.GetAlerts(context.Background(), DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		})

		require.NotNil(t, err)
	})

	t.Run("Cannot save panel with query that is referenced by legacy alerting", func(t *testing.T) {
		panelWithQuery, err := os.ReadFile("./testdata/panel-with-bad-query-id.json")
		require.Nil(t, err)
		dashJSON, err := simplejson.NewJson(panelWithQuery)
		require.Nil(t, err)

		_, err = extractor.GetAlerts(WithUAEnabled(context.Background(), true), DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		})
		require.Equal(t, "alert validation error: Alert on PanelId: 2 refers to query(B) that cannot be found. Legacy alerting queries are not able to be removed at this time in order to preserve the ability to rollback to previous versions of Grafana", err.Error())
	})

	t.Run("Panel does not have datasource configured, use the default datasource", func(t *testing.T) {
		panelWithoutSpecifiedDatasource, err := os.ReadFile("./testdata/panel-without-specified-datasource.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(panelWithoutSpecifiedDatasource)
		require.Nil(t, err)

		dsService.ExpectedDatasource = &datasources.DataSource{ID: 12}
		alerts, err := extractor.GetAlerts(context.Background(), DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		})
		require.Nil(t, err)

		condition := simplejson.NewFromAny(alerts[0].Settings.Get("conditions").MustArray()[0])
		query := condition.Get("query")
		require.EqualValues(t, query.Get("datasourceId").MustInt64(), 12)
	})

	t.Run("Parse alerts from dashboard without rows", func(t *testing.T) {
		json, err := os.ReadFile("./testdata/v5-dashboard.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		alerts, err := extractor.GetAlerts(context.Background(), DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		})
		require.Nil(t, err)

		require.Len(t, alerts, 2)
	})

	t.Run("Alert notifications are in DB", func(t *testing.T) {
		sqlStore := sqlStore{db: sqlstore.InitTestDB(t)}

		firstNotification := models.CreateAlertNotificationCommand{UID: "notifier1", OrgID: 1, Name: "1"}
		_, err = sqlStore.CreateAlertNotificationCommand(context.Background(), &firstNotification)
		require.Nil(t, err)

		secondNotification := models.CreateAlertNotificationCommand{UID: "notifier2", OrgID: 1, Name: "2"}
		_, err = sqlStore.CreateAlertNotificationCommand(context.Background(), &secondNotification)
		require.Nil(t, err)

		json, err := os.ReadFile("./testdata/influxdb-alert.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		alerts, err := extractor.GetAlerts(context.Background(), DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		})
		require.Nil(t, err)

		require.Len(t, alerts, 1)

		for _, alert := range alerts {
			require.EqualValues(t, alert.DashboardID, 4)

			conditions := alert.Settings.Get("conditions").MustArray()
			cond := simplejson.NewFromAny(conditions[0])

			require.Equal(t, cond.Get("query").Get("model").Get("interval").MustString(), ">10s")
		}
	})

	t.Run("Should be able to extract collapsed panels", func(t *testing.T) {
		json, err := os.ReadFile("./testdata/collapsed-panels.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		dash := dashboards.NewDashboardFromJson(dashJSON)

		alerts, err := extractor.GetAlerts(context.Background(), DashAlertInfo{
			User:  nil,
			Dash:  dash,
			OrgID: 1,
		})
		require.Nil(t, err)

		require.Len(t, alerts, 4)
	})

	t.Run("Parse and validate dashboard without id and containing an alert", func(t *testing.T) {
		json, err := os.ReadFile("./testdata/dash-without-id.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		dashAlertInfo := DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		}

		err = extractor.ValidateAlerts(context.Background(), dashAlertInfo)
		require.Nil(t, err)

		_, err = extractor.GetAlerts(context.Background(), dashAlertInfo)
		require.Equal(t, err.Error(), "alert validation error: Panel id is not correct, alertName=Influxdb, panelId=1")
	})

	t.Run("Extract data source given new DataSourceRef object model", func(t *testing.T) {
		json, err := os.ReadFile("./testdata/panel-with-datasource-ref.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		dsService.ExpectedDatasource = graphite2Ds
		dashAlertInfo := DashAlertInfo{
			User:  nil,
			Dash:  dashboards.NewDashboardFromJson(dashJSON),
			OrgID: 1,
		}

		err = extractor.ValidateAlerts(context.Background(), dashAlertInfo)
		require.Nil(t, err)

		alerts, err := extractor.GetAlerts(context.Background(), dashAlertInfo)
		require.Nil(t, err)

		condition := simplejson.NewFromAny(alerts[0].Settings.Get("conditions").MustArray()[0])
		query := condition.Get("query")
		require.EqualValues(t, 15, query.Get("datasourceId").MustInt64())
	})
}

func TestFilterPermissionsErrors(t *testing.T) {
	RegisterCondition("query", func(model *simplejson.Json, index int) (Condition, error) {
		return &FakeCondition{}, nil
	})

	// mock data
	defaultDs := &datasources.DataSource{ID: 12, OrgID: 1, Name: "I am default", IsDefault: true, UID: "def-uid"}

	json, err := os.ReadFile("./testdata/graphite-alert.json")
	require.Nil(t, err)
	dashJSON, err := simplejson.NewJson(json)
	require.Nil(t, err)

	dsPermissions := permissions.NewMockDatasourcePermissionService()
	dsService := &fakeDatasourceService{ExpectedDatasource: defaultDs}
	extractor := ProvideDashAlertExtractorService(dsPermissions, dsService, nil)

	tc := []struct {
		name        string
		result      []*datasources.DataSource
		err         error
		expectedErr error
	}{
		{
			"Data sources are filtered and return results don't return an error",
			[]*datasources.DataSource{defaultDs},
			nil,
			nil,
		},
		{
			"Data sources are filtered but return empty results should return error",
			nil,
			nil,
			datasources.ErrDataSourceAccessDenied,
		},
		{
			"Using default OSS implementation doesn't return an error",
			nil,
			permissions.ErrNotImplemented,
			nil,
		},
		{
			"Returning an error different from ErrNotImplemented should fails",
			nil,
			errors.New("random error"),
			errors.New("random error"),
		},
	}

	for _, test := range tc {
		t.Run(test.name, func(t *testing.T) {
			dsPermissions.DsResult = test.result
			dsPermissions.ErrResult = test.err
			_, err = extractor.GetAlerts(WithUAEnabled(context.Background(), true), DashAlertInfo{
				User:  nil,
				Dash:  dashboards.NewDashboardFromJson(dashJSON),
				OrgID: 1,
			})
			assert.Equal(t, err, test.expectedErr)
		})
	}
}

type fakeDatasourceService struct {
	ExpectedDatasource *datasources.DataSource
	datasources.DataSourceService
}

func (f *fakeDatasourceService) GetDefaultDataSource(ctx context.Context, query *datasources.GetDefaultDataSourceQuery) (*datasources.DataSource, error) {
	return f.ExpectedDatasource, nil
}

func (f *fakeDatasourceService) GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error) {
	return f.ExpectedDatasource, nil
}
