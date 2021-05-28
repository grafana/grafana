package ualert

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util"
)

type alertRule struct {
	OrgId           int64
	Title           string
	Condition       string
	Data            []alertQuery
	IntervalSeconds int64
	Version         int64
	Uid             string
	NamespaceUid    string
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
		RuleOrgID:        a.OrgId,
		RuleUID:          a.Uid,
		RuleNamespaceUID: a.NamespaceUid,
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

func addMigrationInfo(da *dashAlert) map[string]string {
	annotations := da.ParsedSettings.AlertRuleTags
	if annotations == nil {
		annotations = make(map[string]string, 3)
	}

	annotations["__dashboardUid__"] = da.DashboardUID
	annotations["__panelId__"] = fmt.Sprintf("%v", da.PanelId)
	annotations["__alertId__"] = fmt.Sprintf("%v", da.Id)

	return annotations
}

func getMigrationString(da dashAlert) string {
	return fmt.Sprintf(`{"dashboardUid": "%v", "panelId": %v, "alertId": %v}`, da.DashboardUID, da.PanelId, da.Id)
}

func (m *migration) makeAlertRule(cond condition, da dashAlert, folderUID string) (*alertRule, error) {
	annotations := addMigrationInfo(&da)

	ar := &alertRule{
		OrgId:           da.OrgId,
		Title:           da.Name, // TODO: Make sure all names are unique, make new name on constraint insert error.
		Uid:             util.GenerateShortUID(),
		Condition:       cond.Condition,
		Data:            cond.Data,
		IntervalSeconds: ruleAdjustInterval(da.Frequency),
		Version:         1,
		NamespaceUid:    folderUID, // Folder already created, comes from env var.
		RuleGroup:       da.Name,
		For:             duration(da.For),
		Updated:         time.Now().UTC(),
		Annotations:     annotations,
		Labels: map[string]string{
			"alertname": da.Name,
			"message":   da.Message,
		},
	}

	var err error
	ar.NoDataState, err = transNoData(da.ParsedSettings.NoDataState)
	if err != nil {
		return nil, err
	}

	ar.ExecErrState, err = transExecErr(da.ParsedSettings.ExecutionErrorState)
	if err != nil {
		return nil, err
	}

	// Label for routing and silences.
	n, v := getLabelForRouteMatching(ar.Uid)
	ar.Labels[n] = v

	if err := m.addSilence(da, ar); err != nil {
		m.mg.Logger.Error("alert migration error: failed to create silence", "rule_name", ar.Title, "err", err)
	}

	return ar, nil
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
	switch s {
	case "ok":
		return "OK", nil // values from ngalert/models/rule
	case "", "no_data":
		return "NoData", nil
	case "alerting":
		return "Alerting", nil
	case "keep_state":
		return "Alerting", nil
	}
	return "", fmt.Errorf("unrecognized No Data setting %v", s)
}

func transExecErr(s string) (string, error) {
	switch s {
	case "", "alerting":
		return "Alerting", nil
	case "keep_state":
		return "Alerting", nil
	}
	return "", fmt.Errorf("unrecognized Execution Error setting %v", s)
}
