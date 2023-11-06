package ualert

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// ContactLabel is a private label created during migration and used in notification policies.
	// It stores a string array of all contact point names an alert rule should send to.
	// It was created as a means to simplify post-migration notification policies.
	ContactLabel = "__contacts__"
)

type alertRule struct {
	ID              int64 `xorm:"pk autoincr 'id'"`
	OrgID           int64 `xorm:"org_id"`
	Title           string
	Condition       string
	Data            []alertQuery
	IntervalSeconds int64
	Version         int64
	UID             string `xorm:"uid"`
	NamespaceUID    string `xorm:"namespace_uid"`
	RuleGroup       string
	RuleGroupIndex  int `xorm:"rule_group_idx"`
	NoDataState     string
	ExecErrState    string
	For             duration
	Updated         time.Time
	Annotations     map[string]string
	Labels          map[string]string
	IsPaused        bool
}

type alertRuleVersion struct {
	RuleOrgID        int64  `xorm:"rule_org_id"`
	RuleUID          string `xorm:"rule_uid"`
	RuleNamespaceUID string `xorm:"rule_namespace_uid"`
	RuleGroup        string
	RuleGroupIndex   int `xorm:"rule_group_idx"`
	ParentVersion    int64
	RestoredFrom     int64
	Version          int64

	Created         time.Time
	Title           string
	Condition       string
	Data            []alertQuery
	IntervalSeconds int64
	NoDataState     string
	ExecErrState    string
	// ideally this field should have been apimodels.ApiDuration
	// but this is currently not possible because of circular dependencies
	For         duration
	Annotations map[string]string
	Labels      map[string]string
	IsPaused    bool
}

func (a *alertRule) makeVersion() *alertRuleVersion {
	return &alertRuleVersion{
		RuleOrgID:        a.OrgID,
		RuleUID:          a.UID,
		RuleNamespaceUID: a.NamespaceUID,
		RuleGroup:        a.RuleGroup,
		RuleGroupIndex:   a.RuleGroupIndex,
		ParentVersion:    0,
		RestoredFrom:     0,
		Version:          1,

		Created:         time.Now().UTC(),
		Title:           a.Title,
		Condition:       a.Condition,
		Data:            a.Data,
		IntervalSeconds: a.IntervalSeconds,
		NoDataState:     a.NoDataState,
		ExecErrState:    a.ExecErrState,
		For:             a.For,
		Annotations:     a.Annotations,
		Labels:          map[string]string{},
		IsPaused:        a.IsPaused,
	}
}

func addMigrationInfo(da *dashAlert) (map[string]string, map[string]string) {
	tagsMap := simplejson.NewFromAny(da.ParsedSettings.AlertRuleTags).MustMap()
	lbls := make(map[string]string, len(tagsMap))

	for k, v := range tagsMap {
		lbls[k] = simplejson.NewFromAny(v).MustString()
	}

	annotations := make(map[string]string, 3)
	annotations[ngmodels.DashboardUIDAnnotation] = da.DashboardUID
	annotations[ngmodels.PanelIDAnnotation] = fmt.Sprintf("%v", da.PanelId)
	annotations["__alertId__"] = fmt.Sprintf("%v", da.Id)

	return lbls, annotations
}

func (m *migration) makeAlertRule(cond condition, da dashAlert, folderUID string) (*alertRule, error) {
	lbls, annotations := addMigrationInfo(&da)
	annotations["message"] = da.Message
	var err error

	d, err := m.fetchDashboard(da.OrgId, da.DashboardUID)
	// Getting the dashboard is important, as we might want to extract some data out of it. Especially for Graphite queries.Ï
	if err != nil {
		return nil, fmt.Errorf("failed to migrate alert rule queries: related dashboard could not be loaded: %w", err)
	}
	dsTypeMap, err := m.fetchDsTypes(cond.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to migrate alert rule queries: datasources could not be loaded: %w", err)
	}
	l := log.New("ngalert.migration.queries")
	data, err := migrateAlertRuleQueries(l, da.Id, cond.Data, da.PanelId, d, dsTypeMap)
	if err != nil {
		return nil, fmt.Errorf("failed to migrate alert rule queries: %w", err)
	}

	uid, err := m.seenUIDs.generateUid()
	if err != nil {
		return nil, fmt.Errorf("failed to migrate alert rule: %w", err)
	}

	name := normalizeRuleName(da.Name, uid)

	isPaused := false
	if da.State == "paused" {
		isPaused = true
	}

	ar := &alertRule{
		OrgID:           da.OrgId,
		Title:           name, // TODO: Make sure all names are unique, make new name on constraint insert error.
		UID:             uid,
		Condition:       cond.Condition,
		Data:            data,
		IntervalSeconds: ruleAdjustInterval(da.Frequency),
		Version:         1,
		NamespaceUID:    folderUID, // Folder already created, comes from env var.
		RuleGroup:       name,
		For:             duration(da.For),
		Updated:         time.Now().UTC(),
		Annotations:     annotations,
		Labels:          lbls,
		RuleGroupIndex:  1,
		IsPaused:        isPaused,
	}

	ar.NoDataState, err = transNoData(da.ParsedSettings.NoDataState)
	if err != nil {
		return nil, err
	}

	ar.ExecErrState, err = transExecErr(da.ParsedSettings.ExecutionErrorState)
	if err != nil {
		return nil, err
	}

	// Label for routing and silences.
	n, v := getLabelForSilenceMatching(ar.UID)
	ar.Labels[n] = v

	if err := m.addSilence(da, ar); err != nil {
		m.mg.Logger.Error("alert migration error: failed to create silence", "rule_name", ar.Title, "err", err)
	}

	if err := m.addErrorSilence(da, ar); err != nil {
		m.mg.Logger.Error("alert migration error: failed to create silence for Error", "rule_name", ar.Title, "err", err)
	}

	if err := m.addNoDataSilence(da, ar); err != nil {
		m.mg.Logger.Error("alert migration error: failed to create silence for NoData", "rule_name", ar.Title, "err", err)
	}

	return ar, nil
}

func (m *migration) fetchDashboard(orgID int64, dashboardUID string) (*dashboards.Dashboard, error) {
	// This is a hack for unit tests in 9.4.
	if m.sess == nil {
		return &dashboards.Dashboard{}, nil
	}

	var queryResult *dashboards.Dashboard

	dashboard := dashboards.Dashboard{OrgID: orgID, UID: dashboardUID}

	has, err := m.sess.Get(&dashboard)

	if err != nil {
		return nil, err
	} else if !has {
		return nil, dashboards.ErrDashboardNotFound
	}

	dashboard.SetID(dashboard.ID)
	dashboard.SetUID(dashboard.UID)
	queryResult = &dashboard

	return queryResult, err
}

type dsType struct {
	UID  string `xorm:"uid"`
	Type string `xorm:"type"`
}

func (dsType) TableName() string {
	return "data_source"
}

func (m *migration) fetchDsTypes(data []alertQuery) (map[string]string, error) {
	// This is a hack for unit tests in 9.4.
	if m.sess == nil {
		return map[string]string{}, nil
	}

	result := make(map[string]string)
	for _, q := range data {
		result[q.DatasourceUID] = ""
	}
	var dsTypes []*dsType
	for _, uid := range result {
		dsTypes = append(dsTypes, &dsType{UID: uid})
	}

	err := m.sess.Find(&dsTypes)

	for _, ds := range dsTypes {
		result[ds.UID] = ds.Type
	}
	return result, err
}

// migrateAlertRuleQueries attempts to fix alert rule queries so they can work in unified alerting. Queries of some data sources are not compatible with unified alerting.
func migrateAlertRuleQueries(l log.Logger, ruleID int64, data []alertQuery, panelID int64, dashboard *dashboards.Dashboard, dsTypes map[string]string) ([]alertQuery, error) {
	result := make([]alertQuery, 0, len(data))
	for _, d := range data {
		// queries that are expression are not relevant, skip them.
		if d.DatasourceUID == expr.DatasourceType {
			result = append(result, d)
			continue
		}
		dsType, ok := dsTypes[d.DatasourceUID]
		if !ok {
			l.Error("datasource not found", "uid", d.DatasourceUID)
			return nil, fmt.Errorf("datasource not found")
		}
		if dsType != datasources.DS_GRAPHITE {
			continue
		}
		var fixedData map[string]json.RawMessage
		err := json.Unmarshal(d.Model, &fixedData)
		if err != nil {
			return nil, err
		}
		// remove hidden tag from the query (if exists)
		delete(fixedData, "hide")
		fixedData = fixGraphiteReferencedSubQueries(l, fixedData, ruleID, panelID, dashboard)
		updatedModel, err := json.Marshal(fixedData)
		if err != nil {
			return nil, err
		}
		d.Model = updatedModel
		result = append(result, d)
	}
	return result, nil
}

type alertQuery struct {
	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string `json:"refId"`

	// QueryType is an optional identifier for the type of query.
	// It can be used to distinguish different types of queries.
	QueryType string `json:"queryType"`

	// RelativeTimeRange is the relative Start and End of the query as sent by the frontend.
	RelativeTimeRange relativeTimeRange `json:"relativeTimeRange"`

	DatasourceUID string `json:"datasourceUid"`

	// JSON is the raw JSON query and includes the above properties as well as custom properties.
	Model json.RawMessage `json:"model"`
}

// RelativeTimeRange is the per query start and end time
// for requests.
type relativeTimeRange struct {
	From duration `json:"from"`
	To   duration `json:"to"`
}

// duration is a type used for marshalling durations.
type duration time.Duration

func (d duration) String() string {
	return time.Duration(d).String()
}

func (d duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Duration(d).Seconds())
}

func (d *duration) UnmarshalJSON(b []byte) error {
	var v interface{}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	switch value := v.(type) {
	case float64:
		*d = duration(time.Duration(value) * time.Second)
		return nil
	default:
		return fmt.Errorf("invalid duration %v", v)
	}
}

func ruleAdjustInterval(freq int64) int64 {
	// 10 corresponds to the SchedulerCfg, but TODO not worrying about fetching for now.
	var baseFreq int64 = 10
	if freq <= baseFreq {
		return 10
	}
	return freq - (freq % baseFreq)
}

func transNoData(s string) (string, error) {
	switch legacymodels.NoDataOption(s) {
	case legacymodels.NoDataSetOK:
		return string(ngmodels.OK), nil // values from ngalert/models/rule
	case "", legacymodels.NoDataSetNoData:
		return string(ngmodels.NoData), nil
	case legacymodels.NoDataSetAlerting:
		return string(ngmodels.Alerting), nil
	case legacymodels.NoDataKeepState:
		return string(ngmodels.NoData), nil // "keep last state" translates to no data because we now emit a special alert when the state is "noData". The result is that the evaluation will not return firing and instead we'll raise the special alert.
	}
	return "", fmt.Errorf("unrecognized No Data setting %v", s)
}

func transExecErr(s string) (string, error) {
	switch legacymodels.ExecutionErrorOption(s) {
	case "", legacymodels.ExecutionErrorSetAlerting:
		return string(ngmodels.AlertingErrState), nil
	case legacymodels.ExecutionErrorKeepState:
		// Keep last state is translated to error as we now emit a
		// DatasourceError alert when the state is error
		return string(ngmodels.ErrorErrState), nil
	case legacymodels.ExecutionErrorSetOk:
		return string(ngmodels.OkErrState), nil
	}
	return "", fmt.Errorf("unrecognized Execution Error setting %v", s)
}

func normalizeRuleName(daName string, uid string) string {
	// If we have to truncate, we're losing data and so there is higher risk of uniqueness conflicts.
	// Append the UID to the suffix to forcibly break any collisions.
	if len(daName) > DefaultFieldMaxLength {
		trunc := DefaultFieldMaxLength - 1 - len(uid)
		daName = daName[:trunc] + "_" + uid
	}
	// The name can be empty, as this validation did not always exist.
	if daName == "" {
		return uid
	}
	return daName
}

func extractChannelIDs(d dashAlert) (channelUids []uidOrID) {
	// Extracting channel UID/ID.
	for _, ui := range d.ParsedSettings.Notifications {
		if ui.UID != "" {
			channelUids = append(channelUids, ui.UID)
			continue
		}
		// In certain circumstances, id is used instead of uid.
		// We add this if there was no uid.
		if ui.ID > 0 {
			channelUids = append(channelUids, ui.ID)
		}
	}

	return channelUids
}
