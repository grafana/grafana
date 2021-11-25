package alerting

import (
	"context"
	"io/ioutil"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestAlertRuleExtraction(t *testing.T) {
	RegisterCondition("query", func(model *simplejson.Json, index int) (Condition, error) {
		return &FakeCondition{}, nil
	})

	// mock data
	defaultDs := &models.DataSource{Id: 12, OrgId: 1, Name: "I am default", IsDefault: true, Uid: "def-uid"}
	graphite2Ds := &models.DataSource{Id: 15, OrgId: 1, Name: "graphite2", Uid: "graphite2-uid"}
	influxDBDs := &models.DataSource{Id: 16, OrgId: 1, Name: "InfluxDB", Uid: "InfluxDB-uid"}
	prom := &models.DataSource{Id: 17, OrgId: 1, Name: "Prometheus", Uid: "Prometheus-uid"}

	bus.AddHandler("test", func(query *models.GetDefaultDataSourceQuery) error {
		query.Result = defaultDs
		return nil
	})

	bus.AddHandler("test", func(query *models.GetDataSourceQuery) error {
		if query.Name == defaultDs.Name || query.Uid == defaultDs.Uid {
			query.Result = defaultDs
		}
		if query.Name == graphite2Ds.Name || query.Uid == graphite2Ds.Uid {
			query.Result = graphite2Ds
		}
		if query.Name == influxDBDs.Name || query.Uid == influxDBDs.Uid {
			query.Result = influxDBDs
		}
		if query.Name == prom.Name || query.Uid == prom.Uid {
			query.Result = prom
		}

		return nil
	})

	json, err := ioutil.ReadFile("./testdata/graphite-alert.json")
	require.Nil(t, err)

	t.Run("Parsing alert rules from dashboard json", func(t *testing.T) {
		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		dash := models.NewDashboardFromJson(dashJSON)

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

		extractor := NewDashAlertExtractor(dash, 1, nil)
		_, _ = extractor.GetAlerts(context.Background())

		require.Equal(t, getTarget(dashJSON), "")
	})

	t.Run("Parsing and validating dashboard containing graphite alerts", func(t *testing.T) {
		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		alerts, err := extractor.GetAlerts(context.Background())

		require.Nil(t, err)

		require.Len(t, alerts, 2)

		for _, v := range alerts {
			require.EqualValues(t, v.DashboardId, 57)
			require.NotEmpty(t, v.Name)
			require.NotEmpty(t, v.Message)

			settings := simplejson.NewFromAny(v.Settings)
			require.Equal(t, settings.Get("interval").MustString(""), "")
		}

		require.EqualValues(t, alerts[0].Handler, 1)
		require.EqualValues(t, alerts[1].Handler, 0)

		require.EqualValues(t, alerts[0].Frequency, 60)
		require.EqualValues(t, alerts[1].Frequency, 60)

		require.EqualValues(t, alerts[0].PanelId, 3)
		require.EqualValues(t, alerts[1].PanelId, 4)

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
		panelWithoutID, err := ioutil.ReadFile("./testdata/panels-missing-id.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(panelWithoutID)
		require.Nil(t, err)
		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		_, err = extractor.GetAlerts(context.Background())

		require.NotNil(t, err)
	})

	t.Run("Panels missing id should return error", func(t *testing.T) {
		panelWithIDZero, err := ioutil.ReadFile("./testdata/panel-with-id-0.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(panelWithIDZero)
		require.Nil(t, err)
		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		_, err = extractor.GetAlerts(context.Background())

		require.NotNil(t, err)
	})

	t.Run("Panel does not have datasource configured, use the default datasource", func(t *testing.T) {
		panelWithoutSpecifiedDatasource, err := ioutil.ReadFile("./testdata/panel-without-specified-datasource.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(panelWithoutSpecifiedDatasource)
		require.Nil(t, err)
		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		alerts, err := extractor.GetAlerts(context.Background())
		require.Nil(t, err)

		condition := simplejson.NewFromAny(alerts[0].Settings.Get("conditions").MustArray()[0])
		query := condition.Get("query")
		require.EqualValues(t, query.Get("datasourceId").MustInt64(), 12)
	})

	t.Run("Parse alerts from dashboard without rows", func(t *testing.T) {
		json, err := ioutil.ReadFile("./testdata/v5-dashboard.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)
		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		alerts, err := extractor.GetAlerts(context.Background())
		require.Nil(t, err)

		require.Len(t, alerts, 2)
	})

	t.Run("Alert notifications are in DB", func(t *testing.T) {
		sqlStore := sqlstore.InitTestDB(t)

		firstNotification := models.CreateAlertNotificationCommand{Uid: "notifier1", OrgId: 1, Name: "1"}
		err = sqlStore.CreateAlertNotificationCommand(context.Background(), &firstNotification)
		require.Nil(t, err)

		secondNotification := models.CreateAlertNotificationCommand{Uid: "notifier2", OrgId: 1, Name: "2"}
		err = sqlStore.CreateAlertNotificationCommand(context.Background(), &secondNotification)
		require.Nil(t, err)

		json, err := ioutil.ReadFile("./testdata/influxdb-alert.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)
		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		alerts, err := extractor.GetAlerts(context.Background())
		require.Nil(t, err)

		require.Len(t, alerts, 1)

		for _, alert := range alerts {
			require.EqualValues(t, alert.DashboardId, 4)

			conditions := alert.Settings.Get("conditions").MustArray()
			cond := simplejson.NewFromAny(conditions[0])

			require.Equal(t, cond.Get("query").Get("model").Get("interval").MustString(), ">10s")
		}
	})

	t.Run("Should be able to extract collapsed panels", func(t *testing.T) {
		json, err := ioutil.ReadFile("./testdata/collapsed-panels.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)

		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		alerts, err := extractor.GetAlerts(context.Background())
		require.Nil(t, err)

		require.Len(t, alerts, 4)
	})

	t.Run("Parse and validate dashboard without id and containing an alert", func(t *testing.T) {
		json, err := ioutil.ReadFile("./testdata/dash-without-id.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)
		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		err = extractor.ValidateAlerts(context.Background())

		require.Nil(t, err)

		_, err = extractor.GetAlerts(context.Background())
		require.Equal(t, err.Error(), "alert validation error: Panel id is not correct, alertName=Influxdb, panelId=1")
	})

	t.Run("Extract data source given new DataSourceRef object model", func(t *testing.T) {
		json, err := ioutil.ReadFile("./testdata/panel-with-datasource-ref.json")
		require.Nil(t, err)

		dashJSON, err := simplejson.NewJson(json)
		require.Nil(t, err)
		dash := models.NewDashboardFromJson(dashJSON)
		extractor := NewDashAlertExtractor(dash, 1, nil)

		err = extractor.ValidateAlerts(context.Background())

		require.Nil(t, err)

		alerts, err := extractor.GetAlerts(context.Background())
		require.Nil(t, err)

		condition := simplejson.NewFromAny(alerts[0].Settings.Get("conditions").MustArray()[0])
		query := condition.Get("query")
		require.EqualValues(t, 15, query.Get("datasourceId").MustInt64())
	})
}
