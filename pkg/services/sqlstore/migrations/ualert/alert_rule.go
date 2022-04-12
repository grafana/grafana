package ualert

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	legacymodels "github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
	"github.com/grafana/grafana/pkg/util"
)

type alertRule struct {
	OrgID           int64 `xorm:"org_id"`
	Title           string
	Condition       string
	Data            []alertQuery
	IntervalSeconds int64
	Version         int64
	UID             string `xorm:"uid"`
	NamespaceUID    string `xorm:"namespace_uid"`
	RuleGroup       string
	NoDataState     string
	ExecErrState    string
	For             duration
	Updated         time.Time
	Annotations     map[string]string
	Labels          map[string]string // (Labels are not Created in the migration)
}

type alertRuleVersion struct {
	RuleOrgID        int64  `xorm:"rule_org_id"`
	RuleUID          string `xorm:"rule_uid"`
	RuleNamespaceUID string `xorm:"rule_namespace_uid"`
	RuleGroup        string
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
}

func (a *alertRule) makeVersion() *alertRuleVersion {
	return &alertRuleVersion{
		RuleOrgID:        a.OrgID,
		RuleUID:          a.UID,
		RuleNamespaceUID: a.NamespaceUID,
		RuleGroup:        a.RuleGroup,
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
	}
}

func addMigrationInfo(da *dashAlert) (map[string]string, map[string]string) {
	lbls := da.ParsedSettings.AlertRuleTags
	if lbls == nil {
		lbls = make(map[string]string)
	}

	annotations := make(map[string]string, 3)
	annotations[ngmodels.DashboardUIDAnnotation] = da.DashboardUID
	annotations[ngmodels.PanelIDAnnotation] = fmt.Sprintf("%v", da.PanelId)
	annotations["__alertId__"] = fmt.Sprintf("%v", da.Id)

	return lbls, annotations
}

func (m *migration) makeAlertRule(cond condition, da dashAlert, folderUID string) (*alertRule, error) {
	lbls, annotations := addMigrationInfo(&da)
	lbls["alertname"] = da.Name
	annotations["message"] = da.Message
	var err error

	data, err := migrateAlertRuleQueries(cond.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to migrate queries of alert rule [%s] that belongs to a panel [%d] of dashboard [%s]: %w", da.Name, da.PanelId, da.DashboardUID, err)
	}

	ar := &alertRule{
		OrgID:           da.OrgId,
		Title:           da.Name, // TODO: Make sure all names are unique, make new name on constraint insert error.
		UID:             util.GenerateShortUID(),
		Condition:       cond.Condition,
		Data:            data,
		IntervalSeconds: ruleAdjustInterval(da.Frequency),
		Version:         1,
		NamespaceUID:    folderUID, // Folder already created, comes from env var.
		RuleGroup:       da.Name,
		For:             duration(da.For),
		Updated:         time.Now().UTC(),
		Annotations:     annotations,
		Labels:          lbls,
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
	n, v := getLabelForRouteMatching(ar.UID)
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

// migrateAlertRuleQueries attempts to fix alert rule queries so they can work in unified alerting. Queries of some data sources are not compatible with unified alerting.
func migrateAlertRuleQueries(data []alertQuery) ([]alertQuery, error) {
	result := make([]alertQuery, 0, len(data))
	for _, d := range data {
		// queries that are expression are not relevant, skip them.
		if d.DatasourceUID == expr.OldDatasourceUID {
			result = append(result, d)
			continue
		}
		var fixedData map[string]json.RawMessage
		err := json.Unmarshal(d.Model, &fixedData)
		if err != nil {
			return nil, err
		}
		fixedData = convertQueryData(fixedData)
		err = validateQueryData(d, fixedData)
		if err != nil {
			return nil, err
		}
		updatedModel, err := json.Marshal(fixedData)
		if err != nil {
			return nil, err
		}
		d.Model = updatedModel
		result = append(result, d)
	}
	return result, nil
}

// verifyQuery creates a validation function that checks whether the
func validateQueryData(query alertQuery, queryData map[string]json.RawMessage) error {
	if strings.ToLower(query.datasourceType) != "graphite" {
		return nil
	}
	target, ok := queryData[graphite.TargetModelField]
	if !ok {
		return nil
	}
	// similar pattern is used for expanding nested references https://github.com/grafana/grafana/blob/712b239d5ae685db7e8f9d01d5c8aecca611f0b3/public/app/plugins/datasource/graphite/graphite_query.ts#L207
	const pattern = `#[A-Z]`
	match, err := regexp.Match(pattern, target)
	if err != nil {
		return fmt.Errorf("failed check query query [%s] for nested references that match regular expression [%s]: %w", target, pattern, err)
	}
	if match {
		return fmt.Errorf("query to data source contains unexpanded references to other queries: %s", target)
	}
	return nil
}

// convertQueryData looks for field `targetFull` in the query data, and if it exists, overrides field `target`, and then checks whether the target contains references to other queries.
// If the field `targetFull`, which contains expanded query without references to other queries, exists then it means that `target` has not expanded query, which is not supported by the Grafana 8 alerting engine.
func convertQueryData(queryData map[string]json.RawMessage) map[string]json.RawMessage {
	fullQuery, ok := queryData[graphite.TargetFullModelField]
	if ok {
		delete(queryData, graphite.TargetFullModelField)
		queryData[graphite.TargetModelField] = fullQuery
	}

	return queryData
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

	// datasourceType is a type of data source. Omitted during serialization.
	datasourceType string
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
