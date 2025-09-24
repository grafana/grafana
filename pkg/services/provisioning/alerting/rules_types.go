package alerting

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
	"github.com/grafana/grafana/pkg/util"
)

type RuleDelete struct {
	UID   string
	OrgID int64
}

type RuleDeleteV1 struct {
	UID   values.StringValue `json:"uid" yaml:"uid"`
	OrgID values.Int64Value  `json:"orgId" yaml:"orgId"`
}

type AlertRuleGroupV1 struct {
	OrgID    values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name     values.StringValue `json:"name" yaml:"name"`
	Folder   values.StringValue `json:"folder" yaml:"folder"`
	Interval values.StringValue `json:"interval" yaml:"interval"`
	Rules    []AlertRuleV1      `json:"rules" yaml:"rules"`
}

func (ruleGroupV1 *AlertRuleGroupV1) MapToModel() (models.AlertRuleGroupWithFolderFullpath, error) {
	ruleGroup := models.AlertRuleGroupWithFolderFullpath{AlertRuleGroup: &models.AlertRuleGroup{}}
	ruleGroup.Title = ruleGroupV1.Name.Value()
	if strings.TrimSpace(ruleGroup.Title) == "" {
		return models.AlertRuleGroupWithFolderFullpath{}, errors.New("rule group has no name set")
	}
	ruleGroup.OrgID = ruleGroupV1.OrgID.Value()
	if ruleGroup.OrgID < 1 {
		ruleGroup.OrgID = 1
	}
	interval, err := model.ParseDuration(ruleGroupV1.Interval.Value())
	if err != nil {
		return models.AlertRuleGroupWithFolderFullpath{}, err
	}
	ruleGroup.Interval = int64(time.Duration(interval).Seconds())
	ruleGroup.FolderFullpath = ruleGroupV1.Folder.Value()
	if strings.TrimSpace(ruleGroup.FolderFullpath) == "" {
		return models.AlertRuleGroupWithFolderFullpath{}, errors.New("rule group has no folder set")
	}
	for _, ruleV1 := range ruleGroupV1.Rules {
		rule, err := ruleV1.mapToModel(ruleGroup.OrgID)
		if err != nil {
			return models.AlertRuleGroupWithFolderFullpath{}, err
		}
		ruleGroup.Rules = append(ruleGroup.Rules, rule)
	}
	return ruleGroup, nil
}

type AlertRuleV1 struct {
	UID                         values.StringValue      `json:"uid" yaml:"uid"`
	Title                       values.StringValue      `json:"title" yaml:"title"`
	Condition                   values.StringValue      `json:"condition" yaml:"condition"`
	Data                        []QueryV1               `json:"data" yaml:"data"`
	DasboardUID                 values.StringValue      `json:"dasboardUid" yaml:"dasboardUid"` // TODO: Grandfathered typo support. TODO: This should be removed in V2.
	DashboardUID                values.StringValue      `json:"dashboardUid" yaml:"dashboardUid"`
	PanelID                     values.Int64Value       `json:"panelId" yaml:"panelId"`
	NoDataState                 values.StringValue      `json:"noDataState" yaml:"noDataState"`
	ExecErrState                values.StringValue      `json:"execErrState" yaml:"execErrState"`
	For                         values.StringValue      `json:"for" yaml:"for"`
	KeepFiringFor               values.StringValue      `json:"keepFiringFor" yaml:"keepFiringFor"`
	MissingSeriesEvalsToResolve values.Int64Value       `json:"missing_series_evals_to_resolve" yaml:"missing_series_evals_to_resolve"`
	Annotations                 values.StringMapValue   `json:"annotations" yaml:"annotations"`
	Labels                      values.StringMapValue   `json:"labels" yaml:"labels"`
	IsPaused                    values.BoolValue        `json:"isPaused" yaml:"isPaused"`
	NotificationSettings        *NotificationSettingsV1 `json:"notification_settings" yaml:"notification_settings"`
	Record                      *RecordV1               `json:"record" yaml:"record"`
}

func withFallback(value, fallback string) *string {
	if value == "" {
		return &fallback
	}
	return &value
}

func (rule *AlertRuleV1) mapToModel(orgID int64) (models.AlertRule, error) {
	alertRule := models.AlertRule{}
	alertRule.Title = rule.Title.Value()
	if alertRule.Title == "" {
		return models.AlertRule{}, fmt.Errorf("rule has no title set")
	}
	alertRule.UID = rule.UID.Value()
	if alertRule.UID == "" {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: no UID set", alertRule.Title)
	}
	alertRule.OrgID = orgID

	duration := model.Duration(0)
	if rule.For.Value() != "" {
		var err error
		duration, err = model.ParseDuration(rule.For.Value())
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse 'for' field: %w", alertRule.Title, err)
		}
	}
	alertRule.For = time.Duration(duration)

	keepFiringForDuration := model.Duration(0)
	if rule.KeepFiringFor.Value() != "" {
		var err error
		keepFiringForDuration, err = model.ParseDuration(rule.KeepFiringFor.Value())
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse 'keepFiringFor' field: %w", alertRule.Title, err)
		}
	}
	alertRule.KeepFiringFor = time.Duration(keepFiringForDuration)

	if rule.MissingSeriesEvalsToResolve.Raw != "" {
		missingSeriesEvalsToResolve := rule.MissingSeriesEvalsToResolve.Value()
		if missingSeriesEvalsToResolve < 0 {
			return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse 'missing_series_evals_to_resolve' field: cannot be negative", alertRule.Title)
		}
		alertRule.MissingSeriesEvalsToResolve = &missingSeriesEvalsToResolve
	}

	dasboardUID := rule.DasboardUID.Value()
	dashboardUID := rule.DashboardUID.Value()
	alertRule.DashboardUID = withFallback(dashboardUID, dasboardUID) // Use correct spelling over supported typo.
	panelID := rule.PanelID.Value()
	alertRule.PanelID = &panelID
	execErrStateValue := strings.TrimSpace(rule.ExecErrState.Value())
	execErrState, err := models.ErrStateFromString(execErrStateValue)
	if err != nil && execErrStateValue != "" {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
	}
	if execErrStateValue == "" {
		execErrState = models.AlertingErrState
	}
	alertRule.ExecErrState = execErrState
	noDataStateValue := strings.TrimSpace(rule.NoDataState.Value())
	noDataState, err := models.NoDataStateFromString(noDataStateValue)
	if err != nil && noDataStateValue != "" {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
	}
	if noDataStateValue == "" {
		noDataState = models.NoData
	}
	alertRule.NoDataState = noDataState
	alertRule.Condition = rule.Condition.Value()
	if alertRule.Condition == "" {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: no condition set", alertRule.Title)
	}
	alertRule.Annotations = rule.Annotations.Raw
	alertRule.Labels = rule.Labels.Value()
	for _, queryV1 := range rule.Data {
		query, err := queryV1.mapToModel()
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
		}
		alertRule.Data = append(alertRule.Data, query)
	}
	if len(alertRule.Data) == 0 {
		return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: no data set", alertRule.Title)
	}
	alertRule.IsPaused = rule.IsPaused.Value()
	if rule.NotificationSettings != nil {
		ns, err := rule.NotificationSettings.mapToModel()
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
		}
		alertRule.NotificationSettings = append(alertRule.NotificationSettings, ns)
	}
	if rule.Record != nil {
		record, err := rule.Record.mapToModel()
		if err != nil {
			return models.AlertRule{}, fmt.Errorf("rule '%s' failed to parse: %w", alertRule.Title, err)
		}
		alertRule.Record = &record
	}
	return alertRule, nil
}

type QueryV1 struct {
	RefID             values.StringValue       `json:"refId" yaml:"refId"`
	QueryType         values.StringValue       `json:"queryType" yaml:"queryType"`
	RelativeTimeRange models.RelativeTimeRange `json:"relativeTimeRange" yaml:"relativeTimeRange"`
	DatasourceUID     values.StringValue       `json:"datasourceUid" yaml:"datasourceUid"`
	Model             values.JSONValue         `json:"model" yaml:"model"`
}

func (queryV1 *QueryV1) mapToModel() (models.AlertQuery, error) {
	// In order to get the model into the format we need,
	// we marshal it back to json and unmarshal it again
	// in json.RawMessage. We do this as we cannot use
	// json.RawMessage with a yaml files and have to use
	// JSONValue that supports both, json and yaml.
	//
	// We have to use the Raw field here, as Value would
	// try to interpolate macros like `$__timeFilter`, resulting
	// in missing macros in the SQL queries as they would be
	// replaced by an empty string.
	encoded, err := json.Marshal(queryV1.Model.Raw)
	if err != nil {
		return models.AlertQuery{}, err
	}
	var rawMessage json.RawMessage
	err = json.Unmarshal(encoded, &rawMessage)
	if err != nil {
		return models.AlertQuery{}, err
	}
	return models.AlertQuery{
		RefID:             queryV1.RefID.Value(),
		QueryType:         queryV1.QueryType.Value(),
		DatasourceUID:     queryV1.DatasourceUID.Value(),
		RelativeTimeRange: queryV1.RelativeTimeRange,
		Model:             rawMessage,
	}, nil
}

type NotificationSettingsV1 struct {
	Receiver            values.StringValue   `json:"receiver" yaml:"receiver"`
	GroupBy             []values.StringValue `json:"group_by,omitempty" yaml:"group_by"`
	GroupWait           values.StringValue   `json:"group_wait,omitempty" yaml:"group_wait"`
	GroupInterval       values.StringValue   `json:"group_interval,omitempty" yaml:"group_interval"`
	RepeatInterval      values.StringValue   `json:"repeat_interval,omitempty" yaml:"repeat_interval"`
	MuteTimeIntervals   []values.StringValue `json:"mute_time_intervals,omitempty" yaml:"mute_time_intervals"`
	ActiveTimeIntervals []values.StringValue `json:"active_time_intervals,omitempty" yaml:"active_time_intervals"`
}

func (nsV1 *NotificationSettingsV1) mapToModel() (models.NotificationSettings, error) {
	if nsV1.Receiver.Value() == "" {
		return models.NotificationSettings{}, fmt.Errorf("receiver must not be empty")
	}
	var gw, gi, ri *model.Duration
	if nsV1.GroupWait.Value() != "" {
		dur, err := model.ParseDuration(nsV1.GroupWait.Value())
		if err != nil {
			return models.NotificationSettings{}, fmt.Errorf("failed to parse group wait: %w", err)
		}
		gw = util.Pointer(dur)
	}
	if nsV1.GroupInterval.Value() != "" {
		dur, err := model.ParseDuration(nsV1.GroupInterval.Value())
		if err != nil {
			return models.NotificationSettings{}, fmt.Errorf("failed to parse group interval: %w", err)
		}
		gi = util.Pointer(dur)
	}
	if nsV1.RepeatInterval.Value() != "" {
		dur, err := model.ParseDuration(nsV1.RepeatInterval.Value())
		if err != nil {
			return models.NotificationSettings{}, fmt.Errorf("failed to parse repeat interval: %w", err)
		}
		ri = util.Pointer(dur)
	}

	var groupBy []string
	if len(nsV1.GroupBy) > 0 {
		groupBy = make([]string, 0, len(nsV1.GroupBy))
		for _, value := range nsV1.GroupBy {
			if value.Value() == "" {
				continue
			}
			groupBy = append(groupBy, value.Value())
		}
	}

	var mute []string
	if len(nsV1.MuteTimeIntervals) > 0 {
		mute = make([]string, 0, len(nsV1.MuteTimeIntervals))
		for _, value := range nsV1.MuteTimeIntervals {
			if value.Value() == "" {
				continue
			}
			mute = append(mute, value.Value())
		}
	}
	var active []string
	if len(nsV1.ActiveTimeIntervals) > 0 {
		active = make([]string, 0, len(nsV1.ActiveTimeIntervals))
		for _, value := range nsV1.ActiveTimeIntervals {
			if value.Value() == "" {
				continue
			}
			active = append(active, value.Value())
		}
	}

	return models.NotificationSettings{
		Receiver:            nsV1.Receiver.Value(),
		GroupBy:             groupBy,
		GroupWait:           gw,
		GroupInterval:       gi,
		RepeatInterval:      ri,
		MuteTimeIntervals:   mute,
		ActiveTimeIntervals: active,
	}, nil
}

type RecordV1 struct {
	Metric values.StringValue `json:"metric" yaml:"metric"`
	From   values.StringValue `json:"from" yaml:"from"`
}

func (record *RecordV1) mapToModel() (models.Record, error) {
	return models.Record{
		Metric: record.Metric.Value(),
		From:   record.From.Value(),
	}, nil
}
