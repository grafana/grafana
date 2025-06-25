package api

import (
	"bytes"
	"encoding/json"
	"time"

	jsoniter "github.com/json-iterator/go"
	amConfig "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

// AlertRuleFromProvisionedAlertRule converts definitions.ProvisionedAlertRule to models.AlertRule
func AlertRuleFromProvisionedAlertRule(a definitions.ProvisionedAlertRule) (models.AlertRule, error) {
	rule := models.AlertRule{
		ID:                          a.ID,
		UID:                         a.UID,
		OrgID:                       a.OrgID,
		NamespaceUID:                a.FolderUID,
		RuleGroup:                   a.RuleGroup,
		Title:                       a.Title,
		Condition:                   a.Condition,
		Data:                        AlertQueriesFromApiAlertQueries(a.Data),
		Updated:                     a.Updated,
		NoDataState:                 models.NoDataState(a.NoDataState),          // TODO there must be a validation
		ExecErrState:                models.ExecutionErrorState(a.ExecErrState), // TODO there must be a validation
		For:                         time.Duration(a.For),
		KeepFiringFor:               time.Duration(a.KeepFiringFor),
		Annotations:                 a.Annotations,
		Labels:                      a.Labels,
		IsPaused:                    a.IsPaused,
		NotificationSettings:        NotificationSettingsFromAlertRuleNotificationSettings(a.NotificationSettings),
		Record:                      ModelRecordFromApiRecord(a.Record),
		MissingSeriesEvalsToResolve: a.MissingSeriesEvalsToResolve,
	}

	if rule.Type() == models.RuleTypeRecording {
		models.ClearRecordingRuleIgnoredFields(&rule)
	}

	return rule, nil
}

// ProvisionedAlertRuleFromAlertRule converts models.AlertRule to definitions.ProvisionedAlertRule and sets provided provenance status
func ProvisionedAlertRuleFromAlertRule(rule models.AlertRule, provenance models.Provenance) definitions.ProvisionedAlertRule {
	return definitions.ProvisionedAlertRule{
		ID:                          rule.ID,
		UID:                         rule.UID,
		OrgID:                       rule.OrgID,
		FolderUID:                   rule.NamespaceUID,
		RuleGroup:                   rule.RuleGroup,
		Title:                       rule.Title,
		For:                         model.Duration(rule.For),
		KeepFiringFor:               model.Duration(rule.KeepFiringFor),
		Condition:                   rule.Condition,
		Data:                        ApiAlertQueriesFromAlertQueries(rule.Data),
		Updated:                     rule.Updated,
		NoDataState:                 definitions.NoDataState(rule.NoDataState),          // TODO there may be a validation
		ExecErrState:                definitions.ExecutionErrorState(rule.ExecErrState), // TODO there may be a validation
		Annotations:                 rule.Annotations,
		Labels:                      rule.Labels,
		Provenance:                  definitions.Provenance(provenance), // TODO validate enum conversion?
		IsPaused:                    rule.IsPaused,
		NotificationSettings:        AlertRuleNotificationSettingsFromNotificationSettings(rule.NotificationSettings),
		Record:                      ApiRecordFromModelRecord(rule.Record),
		MissingSeriesEvalsToResolve: rule.MissingSeriesEvalsToResolve,
	}
}

// ProvisionedAlertRuleFromAlertRules converts a collection of models.AlertRule to definitions.ProvisionedAlertRules with provenance status models.ProvenanceNone
func ProvisionedAlertRuleFromAlertRules(rules []*models.AlertRule, provenances map[string]models.Provenance) definitions.ProvisionedAlertRules {
	result := make([]definitions.ProvisionedAlertRule, 0, len(rules))
	for _, r := range rules {
		result = append(result, ProvisionedAlertRuleFromAlertRule(*r, provenances[r.UID]))
	}
	return result
}

// AlertQueriesFromApiAlertQueries converts a collection of definitions.AlertQuery to collection of models.AlertQuery
func AlertQueriesFromApiAlertQueries(queries []definitions.AlertQuery) []models.AlertQuery {
	result := make([]models.AlertQuery, 0, len(queries))
	for _, q := range queries {
		result = append(result, models.AlertQuery{
			RefID:     q.RefID,
			QueryType: q.QueryType,
			RelativeTimeRange: models.RelativeTimeRange{
				From: models.Duration(q.RelativeTimeRange.From),
				To:   models.Duration(q.RelativeTimeRange.To),
			},
			DatasourceUID: q.DatasourceUID,
			Model:         q.Model,
		})
	}
	return result
}

// ApiAlertQueriesFromAlertQueries converts a collection of models.AlertQuery to collection of definitions.AlertQuery
func ApiAlertQueriesFromAlertQueries(queries []models.AlertQuery) []definitions.AlertQuery {
	result := make([]definitions.AlertQuery, 0, len(queries))
	for _, q := range queries {
		result = append(result, definitions.AlertQuery{
			RefID:     q.RefID,
			QueryType: q.QueryType,
			RelativeTimeRange: definitions.RelativeTimeRange{
				From: definitions.Duration(q.RelativeTimeRange.From),
				To:   definitions.Duration(q.RelativeTimeRange.To),
			},
			DatasourceUID: q.DatasourceUID,
			Model:         q.Model,
		})
	}
	return result
}

func AlertRuleGroupFromApiAlertRuleGroup(a definitions.AlertRuleGroup) (models.AlertRuleGroup, error) {
	ruleGroup := models.AlertRuleGroup{
		Title:     a.Title,
		FolderUID: a.FolderUID,
		Interval:  a.Interval,
	}
	for i := range a.Rules {
		converted, err := AlertRuleFromProvisionedAlertRule(a.Rules[i])
		if err != nil {
			return models.AlertRuleGroup{}, err
		}
		ruleGroup.Rules = append(ruleGroup.Rules, converted)
	}
	return ruleGroup, nil
}

func ApiAlertRuleGroupFromAlertRuleGroup(d models.AlertRuleGroup) definitions.AlertRuleGroup {
	rules := make([]definitions.ProvisionedAlertRule, 0, len(d.Rules))
	for i := range d.Rules {
		rules = append(rules, ProvisionedAlertRuleFromAlertRule(d.Rules[i], d.Provenance))
	}
	return definitions.AlertRuleGroup{
		Title:     d.Title,
		FolderUID: d.FolderUID,
		Interval:  d.Interval,
		Rules:     rules,
	}
}

// AlertingFileExportFromAlertRuleGroupWithFolderFullpath creates an definitions.AlertingFileExport DTO from []models.AlertRuleGroupWithFolderTitle.
func AlertingFileExportFromAlertRuleGroupWithFolderFullpath(groups []models.AlertRuleGroupWithFolderFullpath) (definitions.AlertingFileExport, error) {
	f := definitions.AlertingFileExport{APIVersion: 1}
	for _, group := range groups {
		export, err := AlertRuleGroupExportFromAlertRuleGroupWithFolderFullpath(group)
		if err != nil {
			return definitions.AlertingFileExport{}, err
		}
		f.Groups = append(f.Groups, export)
	}
	return f, nil
}

// AlertRuleGroupExportFromAlertRuleGroupWithFolderFullpath creates a definitions.AlertRuleGroupExport DTO from models.AlertRuleGroup.
func AlertRuleGroupExportFromAlertRuleGroupWithFolderFullpath(d models.AlertRuleGroupWithFolderFullpath) (definitions.AlertRuleGroupExport, error) {
	rules := make([]definitions.AlertRuleExport, 0, len(d.Rules))
	for i := range d.Rules {
		alert, err := AlertRuleExportFromAlertRule(d.Rules[i])
		if err != nil {
			return definitions.AlertRuleGroupExport{}, err
		}
		rules = append(rules, alert)
	}
	return definitions.AlertRuleGroupExport{
		OrgID:           d.OrgID,
		Name:            d.Title,
		Folder:          d.FolderFullpath,
		FolderUID:       d.FolderUID,
		Interval:        model.Duration(time.Duration(d.Interval) * time.Second),
		IntervalSeconds: d.Interval,
		Rules:           rules,
	}, nil
}

// AlertRuleExportFromAlertRule creates a definitions.AlertRuleExport DTO from models.AlertRule.
func AlertRuleExportFromAlertRule(rule models.AlertRule) (definitions.AlertRuleExport, error) {
	data := make([]definitions.AlertQueryExport, 0, len(rule.Data))
	for i := range rule.Data {
		query, err := AlertQueryExportFromAlertQuery(rule.Data[i])
		if err != nil {
			return definitions.AlertRuleExport{}, err
		}
		data = append(data, query)
	}

	cPtr := &rule.Condition
	if rule.Condition == "" {
		cPtr = nil
	}

	noDataState := definitions.NoDataState(rule.NoDataState)
	ndsPtr := &noDataState
	if noDataState == "" {
		ndsPtr = nil
	}
	execErrorState := definitions.ExecutionErrorState(rule.ExecErrState)
	eesPtr := &execErrorState
	if execErrorState == "" {
		eesPtr = nil
	}

	result := definitions.AlertRuleExport{
		UID:                  rule.UID,
		Title:                rule.Title,
		For:                  model.Duration(rule.For),
		KeepFiringFor:        model.Duration(rule.KeepFiringFor),
		Condition:            cPtr,
		Data:                 data,
		DashboardUID:         rule.DashboardUID,
		PanelID:              rule.PanelID,
		NoDataState:          ndsPtr,
		ExecErrState:         eesPtr,
		IsPaused:             rule.IsPaused,
		NotificationSettings: AlertRuleNotificationSettingsExportFromNotificationSettings(rule.NotificationSettings),
		Record:               AlertRuleRecordExportFromRecord(rule.Record),
	}
	if rule.For.Seconds() > 0 {
		result.ForString = util.Pointer(model.Duration(rule.For).String())
	}
	if rule.KeepFiringFor.Seconds() > 0 {
		result.KeepFiringForString = util.Pointer(model.Duration(rule.KeepFiringFor).String())
	}
	if rule.Annotations != nil {
		result.Annotations = &rule.Annotations
	}
	if rule.Labels != nil {
		result.Labels = &rule.Labels
	}
	if rule.MissingSeriesEvalsToResolve != nil && *rule.MissingSeriesEvalsToResolve != -1 {
		result.MissingSeriesEvalsToResolve = rule.MissingSeriesEvalsToResolve
	}

	return result, nil
}

func encodeQueryModel(m map[string]any) (string, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	err := enc.Encode(m)
	if err != nil {
		return "", err
	}
	return string(bytes.TrimRight(buf.Bytes(), "\n")), nil
}

// AlertQueryExportFromAlertQuery creates a definitions.AlertQueryExport DTO from models.AlertQuery.
func AlertQueryExportFromAlertQuery(query models.AlertQuery) (definitions.AlertQueryExport, error) {
	// We unmarshal the json.RawMessage model into a map in order to facilitate yaml marshalling.
	var mdl map[string]any
	err := json.Unmarshal(query.Model, &mdl)
	if err != nil {
		return definitions.AlertQueryExport{}, err
	}
	var queryType *string
	if query.QueryType != "" {
		queryType = &query.QueryType
	}

	modelString, err := encodeQueryModel(mdl)
	if err != nil {
		return definitions.AlertQueryExport{}, err
	}

	return definitions.AlertQueryExport{
		RefID:     query.RefID,
		QueryType: queryType,
		RelativeTimeRange: definitions.RelativeTimeRangeExport{
			FromSeconds: int64(time.Duration(query.RelativeTimeRange.From).Seconds()),
			ToSeconds:   int64(time.Duration(query.RelativeTimeRange.To).Seconds()),
		},
		DatasourceUID: query.DatasourceUID,
		Model:         mdl,
		ModelString:   modelString,
	}, nil
}

// AlertingFileExportFromEmbeddedContactPoints creates a definitions.AlertingFileExport DTO from []definitions.EmbeddedContactPoint.
func AlertingFileExportFromEmbeddedContactPoints(orgID int64, ecps []definitions.EmbeddedContactPoint) (definitions.AlertingFileExport, error) {
	f := definitions.AlertingFileExport{APIVersion: 1}

	cache := make(map[string]*definitions.ContactPointExport)
	contactPoints := make([]*definitions.ContactPointExport, 0)
	for _, ecp := range ecps {
		c, ok := cache[ecp.Name]
		if !ok {
			c = &definitions.ContactPointExport{
				OrgID:     orgID,
				Name:      ecp.Name,
				Receivers: make([]definitions.ReceiverExport, 0),
			}
			cache[ecp.Name] = c
			contactPoints = append(contactPoints, c)
		}

		recv, err := ReceiverExportFromEmbeddedContactPoint(ecp)
		if err != nil {
			return definitions.AlertingFileExport{}, err
		}
		c.Receivers = append(c.Receivers, recv)
	}

	for _, c := range contactPoints {
		f.ContactPoints = append(f.ContactPoints, *c)
	}
	return f, nil
}

// ReceiverExportFromEmbeddedContactPoint creates a definitions.ReceiverExport DTO from definitions.EmbeddedContactPoint.
func ReceiverExportFromEmbeddedContactPoint(contact definitions.EmbeddedContactPoint) (definitions.ReceiverExport, error) {
	raw, err := contact.Settings.MarshalJSON()
	if err != nil {
		return definitions.ReceiverExport{}, err
	}
	return definitions.ReceiverExport{
		UID:                   contact.UID,
		Type:                  contact.Type,
		Settings:              raw,
		DisableResolveMessage: contact.DisableResolveMessage,
	}, nil
}

// AlertingFileExportFromRoute creates a definitions.AlertingFileExport DTO from definitions.Route.
func AlertingFileExportFromRoute(orgID int64, route definitions.Route) (definitions.AlertingFileExport, error) {
	f := definitions.AlertingFileExport{
		APIVersion: 1,
		Policies: []definitions.NotificationPolicyExport{{
			OrgID:       orgID,
			RouteExport: RouteExportFromRoute(&route),
		}},
	}
	return f, nil
}

// RouteExportFromRoute creates a definitions.RouteExport DTO from definitions.Route.
func RouteExportFromRoute(route *definitions.Route) *definitions.RouteExport {
	toStringIfNotNil := func(d *model.Duration) *string {
		if d == nil {
			return nil
		}
		s := d.String()
		return &s
	}

	matchers := make([]*definitions.MatcherExport, 0, len(route.ObjectMatchers))
	for _, matcher := range route.ObjectMatchers {
		matchers = append(matchers, &definitions.MatcherExport{
			Label: matcher.Name,
			Match: matcher.Type.String(),
			Value: matcher.Value,
		})
	}

	export := definitions.RouteExport{
		Receiver:            route.Receiver,
		GroupByStr:          NilIfEmpty(util.Pointer(route.GroupByStr)),
		Match:               route.Match,
		MatchRE:             route.MatchRE,
		Matchers:            route.Matchers,
		ObjectMatchers:      route.ObjectMatchers,
		ObjectMatchersSlice: matchers,
		MuteTimeIntervals:   NilIfEmpty(util.Pointer(route.MuteTimeIntervals)),
		ActiveTimeIntervals: NilIfEmpty(util.Pointer(route.ActiveTimeIntervals)),
		Continue:            OmitDefault(util.Pointer(route.Continue)),
		GroupWait:           toStringIfNotNil(route.GroupWait),
		GroupInterval:       toStringIfNotNil(route.GroupInterval),
		RepeatInterval:      toStringIfNotNil(route.RepeatInterval),
	}

	if len(route.Routes) > 0 {
		export.Routes = make([]*definitions.RouteExport, 0, len(route.Routes))
		for _, r := range route.Routes {
			export.Routes = append(export.Routes, RouteExportFromRoute(r))
		}
	}

	return &export
}

// OmitDefault returns nil if the value is the default.
func OmitDefault[T comparable](v *T) *T {
	var def T
	if v == nil {
		return v
	}
	if *v == def {
		return nil
	}
	return v
}

// NilIfEmpty returns nil if pointer to slice points to the empty slice.
func NilIfEmpty[T any](v *[]T) *[]T {
	if v == nil || len(*v) == 0 {
		return nil
	}
	return v
}

func AlertingFileExportFromMuteTimings(orgID int64, m []definitions.MuteTimeInterval) definitions.AlertingFileExport {
	f := definitions.AlertingFileExport{
		APIVersion:  1,
		MuteTimings: make([]definitions.MuteTimeIntervalExport, 0, len(m)),
	}
	for _, mi := range m {
		f.MuteTimings = append(f.MuteTimings, MuteTimeIntervalExportFromMuteTiming(orgID, mi))
	}
	return f
}

func MuteTimeIntervalExportFromMuteTiming(orgID int64, m definitions.MuteTimeInterval) definitions.MuteTimeIntervalExport {
	return definitions.MuteTimeIntervalExport{
		OrgID:            orgID,
		MuteTimeInterval: m.MuteTimeInterval,
	}
}

// Converts definitions.MuteTimeIntervalExport to definitions.MuteTimeIntervalExportHcl using JSON marshalling. Returns error if structure could not be marshalled\unmarshalled
func MuteTimingIntervalToMuteTimeIntervalHclExport(m definitions.MuteTimeIntervalExport) (definitions.MuteTimeIntervalExportHcl, error) {
	result := definitions.MuteTimeIntervalExportHcl{}
	j := jsoniter.ConfigCompatibleWithStandardLibrary
	mdata, err := j.Marshal(m)
	if err != nil {
		return result, err
	}
	err = j.Unmarshal(mdata, &result)
	return result, err
}

// AlertRuleEditorSettingsFromEditorSettings converts models.EditorSettings to definitions.AlertRuleEditorSettings
func AlertRuleEditorSettingsFromModelEditorSettings(es models.EditorSettings) *definitions.AlertRuleEditorSettings {
	return &definitions.AlertRuleEditorSettings{
		SimplifiedQueryAndExpressionsSection: es.SimplifiedQueryAndExpressionsSection,
		SimplifiedNotificationsSection:       es.SimplifiedNotificationsSection,
	}
}

// AlertRuleMetadataFromMetadata converts models.AlertRuleMetadata to definitions.AlertRuleMetadata
func AlertRuleMetadataFromModelMetadata(es models.AlertRuleMetadata) *definitions.AlertRuleMetadata {
	return &definitions.AlertRuleMetadata{
		EditorSettings: *AlertRuleEditorSettingsFromModelEditorSettings(es.EditorSettings),
	}
}

// AlertRuleNotificationSettingsFromNotificationSettings converts []models.NotificationSettings to definitions.AlertRuleNotificationSettings
func AlertRuleNotificationSettingsFromNotificationSettings(ns []models.NotificationSettings) *definitions.AlertRuleNotificationSettings {
	if len(ns) == 0 {
		return nil
	}
	m := ns[0]
	return &definitions.AlertRuleNotificationSettings{
		Receiver:            m.Receiver,
		GroupBy:             m.GroupBy,
		GroupWait:           m.GroupWait,
		GroupInterval:       m.GroupInterval,
		RepeatInterval:      m.RepeatInterval,
		MuteTimeIntervals:   m.MuteTimeIntervals,
		ActiveTimeIntervals: m.ActiveTimeIntervals,
	}
}

// AlertRuleNotificationSettingsFromNotificationSettings converts []models.NotificationSettings to definitions.AlertRuleNotificationSettingsExport
func AlertRuleNotificationSettingsExportFromNotificationSettings(ns []models.NotificationSettings) *definitions.AlertRuleNotificationSettingsExport {
	if len(ns) == 0 {
		return nil
	}
	m := ns[0]

	toStringIfNotNil := func(d *model.Duration) *string {
		if d == nil {
			return nil
		}
		s := d.String()
		return &s
	}

	return &definitions.AlertRuleNotificationSettingsExport{
		Receiver:            m.Receiver,
		GroupBy:             m.GroupBy,
		GroupWait:           toStringIfNotNil(m.GroupWait),
		GroupInterval:       toStringIfNotNil(m.GroupInterval),
		RepeatInterval:      toStringIfNotNil(m.RepeatInterval),
		MuteTimeIntervals:   m.MuteTimeIntervals,
		ActiveTimeIntervals: m.ActiveTimeIntervals,
	}
}

// NotificationSettingsFromAlertRuleNotificationSettings converts definitions.AlertRuleNotificationSettings to []models.NotificationSettings
func NotificationSettingsFromAlertRuleNotificationSettings(ns *definitions.AlertRuleNotificationSettings) []models.NotificationSettings {
	if ns == nil {
		return nil
	}
	return []models.NotificationSettings{
		{
			Receiver:            ns.Receiver,
			GroupBy:             ns.GroupBy,
			GroupWait:           ns.GroupWait,
			GroupInterval:       ns.GroupInterval,
			RepeatInterval:      ns.RepeatInterval,
			MuteTimeIntervals:   ns.MuteTimeIntervals,
			ActiveTimeIntervals: ns.ActiveTimeIntervals,
		},
	}
}

func pointerOmitEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func AlertRuleRecordExportFromRecord(r *models.Record) *definitions.AlertRuleRecordExport {
	if r == nil {
		return nil
	}
	return &definitions.AlertRuleRecordExport{
		Metric:              r.Metric,
		From:                r.From,
		TargetDatasourceUID: pointerOmitEmpty(r.TargetDatasourceUID),
	}
}

func ModelRecordFromApiRecord(r *definitions.Record) *models.Record {
	if r == nil {
		return nil
	}
	return &models.Record{
		Metric:              r.Metric,
		From:                r.From,
		TargetDatasourceUID: r.TargetDatasourceUID,
	}
}

func ApiRecordFromModelRecord(r *models.Record) *definitions.Record {
	if r == nil {
		return nil
	}
	return &definitions.Record{
		Metric:              r.Metric,
		From:                r.From,
		TargetDatasourceUID: r.TargetDatasourceUID,
	}
}

func GettableGrafanaReceiverFromReceiver(r *models.Integration, provenance models.Provenance) (definitions.GettableGrafanaReceiver, error) {
	out := definitions.GettableGrafanaReceiver{
		UID:                   r.UID,
		Name:                  r.Name,
		Type:                  r.Config.Type,
		Provenance:            definitions.Provenance(provenance),
		DisableResolveMessage: r.DisableResolveMessage,
		SecureFields:          r.SecureFields(),
	}

	if len(r.Settings) > 0 {
		jsonBytes, err := json.Marshal(r.Settings)
		if err != nil {
			return definitions.GettableGrafanaReceiver{}, err
		}
		out.Settings = jsonBytes
	}

	return out, nil
}

func GettableApiReceiverFromReceiver(r *models.Receiver) (*definitions.GettableApiReceiver, error) {
	out := definitions.GettableApiReceiver{
		Receiver: amConfig.Receiver{
			Name: r.Name,
		},
		GettableGrafanaReceivers: definitions.GettableGrafanaReceivers{
			GrafanaManagedReceivers: make([]*definitions.GettableGrafanaReceiver, 0, len(r.Integrations)),
		},
	}

	for _, integration := range r.Integrations {
		gettable, err := GettableGrafanaReceiverFromReceiver(integration, r.Provenance)
		if err != nil {
			return nil, err
		}
		out.GrafanaManagedReceivers = append(out.GrafanaManagedReceivers, &gettable)
	}
	return &out, nil
}

func GettableApiReceiversFromReceivers(recvs []*models.Receiver) ([]*definitions.GettableApiReceiver, error) {
	out := make([]*definitions.GettableApiReceiver, 0, len(recvs))
	for _, r := range recvs {
		gettables, err := GettableApiReceiverFromReceiver(r)
		if err != nil {
			return nil, err
		}
		out = append(out, gettables)
	}
	return out, nil
}
