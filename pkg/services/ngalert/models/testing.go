package models

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/rand"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/google/uuid"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"

	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

var (
	RuleMuts = AlertRuleMutators{}
	NSMuts   = NotificationSettingsMutators{}
	RuleGen  = &AlertRuleGenerator{
		mutators: []AlertRuleMutator{
			RuleMuts.WithUniqueUID(), RuleMuts.WithUniqueTitle(),
		},
	}
)

type AlertRuleMutator func(r *AlertRule)

type AlertRuleGenerator struct {
	AlertRuleMutators
	mutators []AlertRuleMutator
}

func (g *AlertRuleGenerator) With(mutators ...AlertRuleMutator) *AlertRuleGenerator {
	return &AlertRuleGenerator{
		AlertRuleMutators: g.AlertRuleMutators,
		mutators:          append(g.mutators, mutators...),
	}
}

func (g *AlertRuleGenerator) Generate() AlertRule {
	randNoDataState := func() NoDataState {
		s := [...]NoDataState{
			Alerting,
			NoData,
			OK,
		}
		return s[rand.Intn(len(s))]
	}

	randErrState := func() ExecutionErrorState {
		s := [...]ExecutionErrorState{
			AlertingErrState,
			ErrorErrState,
			OkErrState,
		}
		return s[rand.Intn(len(s))]
	}

	interval := (rand.Int63n(6) + 1) * 10
	forInterval := time.Duration(interval*rand.Int63n(6)) * time.Second
	keepFiringFor := time.Duration(interval*rand.Int63n(6)) * time.Second

	var annotations map[string]string = nil
	if rand.Int63()%2 == 0 {
		annotations = GenerateAlertLabels(rand.Intn(5), "ann-")
	}
	var labels map[string]string = nil
	if rand.Int63()%2 == 0 {
		labels = GenerateAlertLabels(rand.Intn(5), "lbl-")
	}

	var dashUID *string = nil
	var panelID *int64 = nil
	if rand.Int63()%2 == 0 {
		d := util.GenerateShortUID()
		dashUID = &d
		p := rand.Int63n(1500)
		panelID = &p
	}

	var ns []NotificationSettings
	if rand.Int63()%2 == 0 {
		ns = append(ns, NotificationSettingsGen()())
	}

	var updatedBy *UserUID
	if rand.Int63()%2 == 0 {
		updatedBy = util.Pointer(UserUID(util.GenerateShortUID()))
	}

	rule := AlertRule{
		ID:                          0,
		GUID:                        uuid.NewString(),
		OrgID:                       rand.Int63n(1500) + 1, // Prevent OrgID=0 as this does not pass alert rule validation.
		Title:                       fmt.Sprintf("title-%s", util.GenerateShortUID()),
		Condition:                   "A",
		Data:                        []AlertQuery{g.GenerateQuery()},
		Updated:                     time.Now().Add(-time.Duration(rand.Intn(100) + 1)),
		UpdatedBy:                   updatedBy,
		IntervalSeconds:             rand.Int63n(60) + 1,
		Version:                     rand.Int63n(1500), // Don't generate a rule ID too big for postgres
		UID:                         util.GenerateShortUID(),
		NamespaceUID:                util.GenerateShortUID(),
		DashboardUID:                dashUID,
		PanelID:                     panelID,
		RuleGroup:                   fmt.Sprintf("group-%s,", util.GenerateShortUID()),
		RuleGroupIndex:              rand.Intn(1500),
		NoDataState:                 randNoDataState(),
		ExecErrState:                randErrState(),
		For:                         forInterval,
		KeepFiringFor:               keepFiringFor,
		Annotations:                 annotations,
		Labels:                      labels,
		NotificationSettings:        ns,
		Metadata:                    GenerateMetadata(),
		MissingSeriesEvalsToResolve: util.Pointer[int64](2),
	}

	for _, mutator := range g.mutators {
		mutator(&rule)
	}
	return rule
}

func (g *AlertRuleGenerator) GenerateRef() *AlertRule {
	r := g.Generate()
	return &r
}

func (g *AlertRuleGenerator) getCount(bounds ...int) int {
	count := 0
	if len(bounds) == 0 {
		count = rand.Intn(5) + 1
	}
	if len(bounds) == 1 {
		count = bounds[0]
	}
	if len(bounds) == 2 {
		if bounds[0] > bounds[1] {
			panic("min should not be greater than max")
		} else if bounds[0] < bounds[1] {
			count = rand.Intn(bounds[1]-bounds[0]) + bounds[0]
		} else {
			count = bounds[0]
		}
	}
	if len(bounds) > 2 {
		panic("invalid number of parameter must be up to 2")
	}
	return count
}

func (g *AlertRuleGenerator) GenerateMany(bounds ...int) []AlertRule {
	count := g.getCount(bounds...)
	result := make([]AlertRule, 0, count)
	for i := 0; i < count; i++ {
		result = append(result, g.Generate())
	}
	return result
}

func (g *AlertRuleGenerator) GenerateManyRef(bounds ...int) []*AlertRule {
	count := g.getCount(bounds...)

	result := make([]*AlertRule, 0)
	for i := 0; i < count; i++ {
		r := g.Generate()
		result = append(result, &r)
	}
	return result
}

type AlertRuleMutators struct {
}

func (a *AlertRuleMutators) WithNotEmptyLabels(count int, prefix string) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Labels = GenerateAlertLabels(count, prefix)
	}
}

func (a *AlertRuleMutators) WithUniqueID() AlertRuleMutator {
	ids := sync.Map{}
	return func(rule *AlertRule) {
		id := rule.ID
		for {
			_, exists := ids.LoadOrStore(id, struct{}{})
			if !exists {
				rule.ID = id
				return
			}
			id = rand.Int63n(1500) + 1
		}
	}
}

func (a *AlertRuleMutators) WithEditorSettingsSimplifiedQueryAndExpressionsSection(enabled bool) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection = enabled
	}
}

func (a *AlertRuleMutators) WithEditorSettingsSimplifiedNotificationsSection(enabled bool) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Metadata.EditorSettings.SimplifiedNotificationsSection = enabled
	}
}

func (a *AlertRuleMutators) WithPrometheusOriginalRuleDefinition(definition string) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Metadata.PrometheusStyleRule = &PrometheusStyleRule{
			OriginalRuleDefinition: definition,
		}
	}
}

func (a *AlertRuleMutators) WithGroupIndex(groupIndex int) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.RuleGroupIndex = groupIndex
	}
}

func (a *AlertRuleMutators) WithUniqueGroupIndex() AlertRuleMutator {
	usedIdx := sync.Map{}
	return func(rule *AlertRule) {
		idx := rule.RuleGroupIndex
		for {
			if _, exists := usedIdx.LoadOrStore(idx, struct{}{}); !exists {
				rule.RuleGroupIndex = idx
				return
			}
			idx = rand.Int()
		}
	}
}

func (a *AlertRuleMutators) WithSequentialGroupIndex() AlertRuleMutator {
	idx := 1
	m := sync.Mutex{}
	return func(rule *AlertRule) {
		m.Lock()
		defer m.Unlock()
		rule.RuleGroupIndex = idx
		idx++
	}
}

func (a *AlertRuleMutators) WithOrgID(orgId int64) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.OrgID = orgId
	}
}

func (a *AlertRuleMutators) WithUniqueOrgID() AlertRuleMutator {
	orgs := sync.Map{}
	return func(rule *AlertRule) {
		orgID := rule.OrgID
		for {
			if _, exist := orgs.LoadOrStore(orgID, struct{}{}); !exist {
				rule.OrgID = orgID
				return
			}
			orgID = rand.Int63()
		}
	}
}

// WithNamespaceUIDNotIn generates a random namespace UID if it is among excluded
func (a *AlertRuleMutators) WithNamespaceUIDNotIn(exclude ...string) AlertRuleMutator {
	return func(rule *AlertRule) {
		for {
			if !slices.Contains(exclude, rule.NamespaceUID) {
				return
			}
			rule.NamespaceUID = util.GenerateShortUID()
		}
	}
}

func (a *AlertRuleMutators) WithNamespaceUID(namespaceUID string) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.NamespaceUID = namespaceUID
	}
}

func (a *AlertRuleMutators) WithNamespace(namespace *folder.FolderReference) AlertRuleMutator {
	return a.WithNamespaceUID(namespace.UID)
}

func (a *AlertRuleMutators) WithInterval(interval time.Duration) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.IntervalSeconds = int64(interval.Seconds())
	}
}

func (a *AlertRuleMutators) WithIntervalSeconds(seconds int64) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.IntervalSeconds = seconds
	}
}

// WithIntervalMatching mutator that generates random interval and `for` duration that are times of the provided base interval.
func (a *AlertRuleMutators) WithIntervalMatching(baseInterval time.Duration) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.IntervalSeconds = int64(baseInterval.Seconds()) * (rand.Int63n(10) + 1)
		rule.For = time.Duration(rule.IntervalSeconds*rand.Int63n(9)+1) * time.Second
	}
}

func (a *AlertRuleMutators) WithIntervalBetween(min, max int64) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.IntervalSeconds = rand.Int63n(max-min) + min
	}
}

func (a *AlertRuleMutators) WithTitle(title string) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Title = title
	}
}

func (a *AlertRuleMutators) WithFor(duration time.Duration) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.For = duration
	}
}

func (a *AlertRuleMutators) WithForNTimes(timesOfInterval int64) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.For = time.Duration(rule.IntervalSeconds*timesOfInterval) * time.Second
	}
}

func (a *AlertRuleMutators) WithKeepFiringFor(interval time.Duration) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.KeepFiringFor = interval
	}
}

func (a *AlertRuleMutators) WithKeepFiringForNTimes(timesOfInterval int64) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.KeepFiringFor = time.Duration(rule.IntervalSeconds*timesOfInterval) * time.Second
	}
}

func (a *AlertRuleMutators) WithNoDataExecAs(nodata NoDataState) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.NoDataState = nodata
	}
}

func (a *AlertRuleMutators) WithErrorExecAs(err ExecutionErrorState) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.ExecErrState = err
	}
}

func (a *AlertRuleMutators) WithAnnotations(lbls data.Labels) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Annotations = lbls
	}
}

func (a *AlertRuleMutators) WithAnnotation(key, value string) AlertRuleMutator {
	return func(rule *AlertRule) {
		if rule.Annotations == nil {
			rule.Annotations = data.Labels{}
		}
		rule.Annotations[key] = value
	}
}

func (a *AlertRuleMutators) WithLabels(lbls data.Labels) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Labels = lbls
	}
}

func (a *AlertRuleMutators) WithLabel(key, value string) AlertRuleMutator {
	return func(rule *AlertRule) {
		if rule.Labels == nil {
			rule.Labels = data.Labels{}
		}
		rule.Labels[key] = value
	}
}

func (a *AlertRuleMutators) WithDashboardAndPanel(dashboardUID *string, panelID *int64) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.DashboardUID = dashboardUID
		rule.PanelID = panelID
	}
}

// WithUniqueUID returns AlertRuleMutator that generates a random UID if it is among UIDs known by the instance of mutator.
// NOTE: two instances of the mutator do not share known UID.
// Example #1 reuse mutator instance:
//
//	mut := WithUniqueUID()
//	rule1 := RuleGen.With(mut).Generate()
//	rule2 := RuleGen.With(mut).Generate()
//
// Example #2 reuse generator:
//
//	gen := RuleGen.With(WithUniqueUID())
//	rule1 := gen.Generate()
//	rule2 := gen.Generate()
//
// Example #3 non-unique:
//
//	rule1 := RuleGen.With(WithUniqueUID()).Generate
//	rule2 := RuleGen.With(WithUniqueUID()).Generate
func (a *AlertRuleMutators) WithUniqueUID() AlertRuleMutator {
	uids := sync.Map{}
	return func(rule *AlertRule) {
		uid := rule.UID
		for {
			_, exist := uids.LoadOrStore(uid, struct{}{})
			if !exist {
				rule.UID = uid
				return
			}
			uid = util.GenerateShortUID()
		}
	}
}

// WithUniqueTitle returns AlertRuleMutator that generates a random title if the rule's title is among titles known by the instance of mutator.
// Two instances of the mutator do not share known titles.
// Example #1 reuse mutator instance:
//
//	mut := WithUniqueTitle()
//	rule1 := RuleGen.With(mut).Generate()
//	rule2 := RuleGen.With(mut).Generate()
//
// Example #2 reuse generator:
//
//	gen := RuleGen.With(WithUniqueTitle())
//	rule1 := gen.Generate()
//	rule2 := gen.Generate()
//
// Example #3 non-unique:
//
//	rule1 := RuleGen.With(WithUniqueTitle()).Generate
//	rule2 := RuleGen.With(WithUniqueTitle()).Generate
func (a *AlertRuleMutators) WithUniqueTitle() AlertRuleMutator {
	titles := sync.Map{}
	return func(rule *AlertRule) {
		title := rule.Title
		for {
			_, exist := titles.LoadOrStore(title, struct{}{})
			if !exist {
				rule.Title = title
				return
			}
			title = fmt.Sprintf("title-%s", util.GenerateShortUID())
		}
	}
}

func (a *AlertRuleMutators) WithQuery(query ...AlertQuery) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Data = query
		if len(query) > 1 {
			rule.Condition = query[0].RefID
		}
	}
}

func (a *AlertRuleMutators) WithGroupName(groupName string) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.RuleGroup = groupName
	}
}

func (a *AlertRuleMutators) WithGroupPrefix(prefix string) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.RuleGroup = fmt.Sprintf("%s%s", prefix, util.GenerateShortUID())
	}
}

func (a *AlertRuleMutators) WithGroupKey(groupKey AlertRuleGroupKey) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.RuleGroup = groupKey.RuleGroup
		rule.OrgID = groupKey.OrgID
		rule.NamespaceUID = groupKey.NamespaceUID
	}
}

// WithSameGroup generates a random group name and assigns it to all rules passed to it
func (a *AlertRuleMutators) WithSameGroup() AlertRuleMutator {
	once := sync.Once{}
	name := ""
	return func(rule *AlertRule) {
		once.Do(func() {
			name = util.GenerateShortUID()
		})
		rule.RuleGroup = name
	}
}

func (a *AlertRuleMutators) WithMissingSeriesEvalsToResolve(timesOfInterval int64) AlertRuleMutator {
	return func(rule *AlertRule) {
		if timesOfInterval <= 0 {
			panic("timesOfInterval must be greater than 0")
		}
		rule.MissingSeriesEvalsToResolve = util.Pointer[int64](timesOfInterval)
	}
}

func (a *AlertRuleMutators) WithNotificationSettingsGen(ns func() NotificationSettings) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.NotificationSettings = []NotificationSettings{ns()}
	}
}
func (a *AlertRuleMutators) WithNotificationSettings(ns NotificationSettings) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.NotificationSettings = []NotificationSettings{ns}
	}
}

func (a *AlertRuleMutators) WithNoNotificationSettings() AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.NotificationSettings = nil
	}
}

func (a *AlertRuleMutators) WithIsPaused(paused bool) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.IsPaused = paused
	}
}

func (a *AlertRuleMutators) WithRandomRecordingRules() AlertRuleMutator {
	return func(rule *AlertRule) {
		if rand.Int63()%2 == 0 {
			return
		}
		ConvertToRecordingRule(rule)
	}
}

func (a *AlertRuleMutators) WithAllRecordingRules() AlertRuleMutator {
	return func(rule *AlertRule) {
		ConvertToRecordingRule(rule)
	}
}

func (a *AlertRuleMutators) WithMetric(metric string) AlertRuleMutator {
	return func(rule *AlertRule) {
		if rule.Record == nil {
			rule.Record = &Record{}
		}
		rule.Record.Metric = metric
	}
}

func (a *AlertRuleMutators) WithRecordFrom(from string) AlertRuleMutator {
	return func(rule *AlertRule) {
		if rule.Record == nil {
			rule.Record = &Record{}
		}
		rule.Record.From = from
	}
}

func (a *AlertRuleMutators) WithUpdatedBy(uid *UserUID) AlertRuleMutator {
	return func(r *AlertRule) {
		r.UpdatedBy = uid
	}
}

func (a *AlertRuleMutators) WithUID(uid string) AlertRuleMutator {
	return func(r *AlertRule) {
		r.UID = uid
	}
}

func (a *AlertRuleMutators) WithKey(key AlertRuleKey) AlertRuleMutator {
	return func(r *AlertRule) {
		r.UID = key.UID
		r.OrgID = key.OrgID
	}
}

func (a *AlertRuleMutators) WithVersion(version int64) AlertRuleMutator {
	return func(r *AlertRule) {
		r.Version = version
	}
}

func (a *AlertRuleMutators) WithMetadata(meta AlertRuleMetadata) AlertRuleMutator {
	return func(r *AlertRule) {
		r.Metadata = meta
	}
}

func (a AlertRuleMutators) WithGUID(guid string) AlertRuleMutator {
	return func(r *AlertRule) {
		r.GUID = guid
	}
}

func (g *AlertRuleGenerator) GenerateLabels(min, max int, prefix string) data.Labels {
	count := max
	if min > max {
		panic("min should not be greater than max")
	} else if min < max {
		count = rand.Intn(max-min) + min
	}
	labels := make(data.Labels, count)
	for i := 0; i < count; i++ {
		labels[prefix+"key-"+util.GenerateShortUID()] = prefix + "value-" + util.GenerateShortUID()
	}
	return labels
}

func GenerateAlertLabels(count int, prefix string) data.Labels {
	return RuleGen.GenerateLabels(count, count, prefix)
}

func GenerateAlertQuery() AlertQuery {
	return RuleGen.GenerateQuery()
}

func (g *AlertRuleGenerator) GenerateQuery() AlertQuery {
	f := rand.Intn(10) + 5
	t := rand.Intn(f)

	return AlertQuery{
		DatasourceUID: util.GenerateShortUID(),
		Model: json.RawMessage(fmt.Sprintf(`{
			"%s": "%s",
			"%s":"%d"
		}`, util.GenerateShortUID(), util.GenerateShortUID(), util.GenerateShortUID(), rand.Int())),
		RelativeTimeRange: RelativeTimeRange{
			From: Duration(time.Duration(f) * time.Minute),
			To:   Duration(time.Duration(t) * time.Minute),
		},
		RefID:     util.GenerateShortUID(),
		QueryType: util.GenerateShortUID(),
	}
}

func (g *AlertRuleGenerator) WithCondition(condition string) AlertRuleMutator {
	return func(r *AlertRule) {
		r.Condition = condition
	}
}

// GenerateRuleKey generates a random alert rule key
func GenerateRuleKey(orgID int64) AlertRuleKey {
	return AlertRuleKey{
		OrgID: orgID,
		UID:   util.GenerateShortUID(),
	}
}

// GenerateRuleKeyWithGroup generates a random alert rule key with group
func GenerateRuleKeyWithGroup(orgID int64) AlertRuleKeyWithGroup {
	return AlertRuleKeyWithGroup{
		AlertRuleKey: GenerateRuleKey(orgID),
		RuleGroup:    util.GenerateShortUID(),
	}
}

// GenerateGroupKey generates a random group key
func GenerateGroupKey(orgID int64) AlertRuleGroupKey {
	return AlertRuleGroupKey{
		OrgID:        orgID,
		NamespaceUID: util.GenerateShortUID(),
		RuleGroup:    util.GenerateShortUID(),
	}
}

// CopyRule creates a deep copy of AlertRule
func CopyRule(r *AlertRule, mutators ...AlertRuleMutator) *AlertRule {
	result := r.Copy()
	if len(mutators) > 0 {
		for _, mutator := range mutators {
			mutator(result)
		}
	}
	return result
}

func CreateClassicConditionExpression(refID string, inputRefID string, reducer string, operation string, threshold int) AlertQuery {
	return AlertQuery{
		RefID:         refID,
		QueryType:     expr.DatasourceType,
		DatasourceUID: expr.DatasourceUID,
		// the format corresponds to model `ClassicConditionJSON` in /pkg/expr/classic/classic.go
		Model: json.RawMessage(fmt.Sprintf(`
		{
			"refId": "%[1]s",
            "hide": false,
            "type": "classic_conditions",
            "datasource": {
                "uid": "%[6]s",
                "type": "%[7]s"
            },
            "conditions": [
                {
                    "type": "query",
                    "evaluator": {
                        "params": [
                            %[4]d
                        ],
                        "type": "%[3]s"
                    },
                    "operator": {
                        "type": "and"
                    },
                    "query": {
                        "params": [
                            "%[2]s"
                        ]
                    },
                    "reducer": {
                        "params": [],
                        "type": "%[5]s"
                    }
                }
            ]
		}`, refID, inputRefID, operation, threshold, reducer, expr.DatasourceUID, expr.DatasourceType)),
	}
}

func CreateReduceExpression(refID string, inputRefID string, reducer string) AlertQuery {
	return AlertQuery{
		RefID:         refID,
		QueryType:     expr.DatasourceType,
		DatasourceUID: expr.DatasourceUID,
		Model: json.RawMessage(fmt.Sprintf(`
		{
			"refId": "%[1]s",
            "hide": false,
            "type": "reduce",
			"expression": "%[2]s",
			"reducer": "%[3]s",
            "datasource": {
                "uid": "%[4]s",
                "type": "%[5]s"
            }
		}`, refID, inputRefID, reducer, expr.DatasourceUID, expr.DatasourceType)),
	}
}

func CreatePrometheusQuery(refID string, expr string, intervalMs int64, maxDataPoints int64, isInstant bool, datasourceUID string) AlertQuery {
	return AlertQuery{
		RefID:         refID,
		QueryType:     "",
		DatasourceUID: datasourceUID,
		Model: json.RawMessage(fmt.Sprintf(`
		{
			"refId": "%[1]s",
			"expr": "%[2]s",
            "intervalMs": %[3]d,
            "maxDataPoints": %[4]d,
			"exemplar": false,
			"instant": %[5]t,
			"range": %[6]t,
            "datasource": {
                "uid": "%[7]s",
                "type": "%[8]s"
            }
		}`, refID, expr, intervalMs, maxDataPoints, isInstant, !isInstant, datasourceUID, datasources.DS_PROMETHEUS)),
	}
}

func CreateLokiQuery(refID string, expr string, intervalMs int64, maxDataPoints int64, queryType string, datasourceUID string) AlertQuery {
	return AlertQuery{
		RefID:         refID,
		QueryType:     queryType,
		DatasourceUID: datasourceUID,
		Model: json.RawMessage(fmt.Sprintf(`
		{
			"refId": "%[1]s",
			"expr": "%[2]s",
            "intervalMs": %[3]d,
            "maxDataPoints": %[4]d,
			"queryType": "%[5]s",
            "datasource": {
                "uid": "%[6]s",
                "type": "%[7]s"
            }
		}`, refID, expr, intervalMs, maxDataPoints, queryType, datasourceUID, datasources.DS_LOKI)),
	}
}

func CreateHysteresisExpression(t *testing.T, refID string, inputRefID string, threshold int, recoveryThreshold int) AlertQuery {
	t.Helper()
	q := AlertQuery{
		RefID:         refID,
		QueryType:     expr.DatasourceType,
		DatasourceUID: expr.DatasourceUID,
		Model: json.RawMessage(fmt.Sprintf(`
		{
			"refId": "%[1]s",
            "type": "threshold",
            "datasource": {
                "uid": "%[5]s",
                "type": "%[6]s"
            },
			"expression": "%[2]s",
            "conditions": [
                {
                    "type": "query",
                    "evaluator": {
                        "params": [
                            %[3]d
                        ],
                        "type": "gt"
                    },
					"unloadEvaluator": {
                        "params": [
                            %[4]d
                        ],
                        "type": "lt"
					}
                }
            ]
		}`, refID, inputRefID, threshold, recoveryThreshold, expr.DatasourceUID, expr.DatasourceType)),
	}
	h, err := q.IsHysteresisExpression()
	require.NoError(t, err)
	require.Truef(t, h, "test model is expected to be a hysteresis expression")
	return q
}

func GenerateMetadata() AlertRuleMetadata {
	return AlertRuleMetadata{
		EditorSettings: EditorSettings{
			SimplifiedQueryAndExpressionsSection: rand.Int()%2 == 0,
			SimplifiedNotificationsSection:       rand.Int()%2 == 0,
		},
	}
}

type AlertInstanceMutator func(*AlertInstance)

// AlertInstanceGen provides a factory function that generates a random AlertInstance.
// The mutators arguments allows changing fields of the resulting structure.
func AlertInstanceGen(mutators ...AlertInstanceMutator) *AlertInstance {
	var labels map[string]string = nil
	if rand.Int63()%2 == 0 {
		labels = GenerateAlertLabels(rand.Intn(5), "lbl-")
	}

	randState := func() InstanceStateType {
		s := [...]InstanceStateType{
			InstanceStateFiring,
			InstanceStateNormal,
			InstanceStatePending,
			InstanceStateNoData,
			InstanceStateError,
			InstanceStateRecovering,
		}
		return s[rand.Intn(len(s))]
	}

	currentStateSince := time.Now().Add(-time.Duration(rand.Intn(100) + 1))

	instance := &AlertInstance{
		AlertInstanceKey: AlertInstanceKey{
			RuleOrgID:  rand.Int63n(1500),
			RuleUID:    util.GenerateShortUID(),
			LabelsHash: util.GenerateShortUID(),
		},
		Labels:            labels,
		CurrentState:      randState(),
		CurrentReason:     "TEST-REASON-" + util.GenerateShortUID(),
		CurrentStateSince: currentStateSince,
		CurrentStateEnd:   currentStateSince.Add(time.Duration(rand.Intn(100) + 200)),
		LastEvalTime:      time.Now().Add(-time.Duration(rand.Intn(100) + 50)),
		LastSentAt:        util.Pointer(time.Now().Add(-time.Duration(rand.Intn(100) + 50))),
	}

	if instance.CurrentState == InstanceStateNormal && rand.Intn(2) == 1 {
		instance.ResolvedAt = util.Pointer(time.Now().Add(-time.Duration(rand.Intn(100) + 50)))
	}

	for _, mutator := range mutators {
		mutator(instance)
	}
	return instance
}

type Mutator[T any] func(*T)

// CopyNotificationSettings creates a deep copy of NotificationSettings.
func CopyNotificationSettings(ns NotificationSettings, mutators ...Mutator[NotificationSettings]) NotificationSettings {
	c := NotificationSettings{
		Receiver: ns.Receiver,
	}
	if ns.GroupWait != nil {
		c.GroupWait = util.Pointer(*ns.GroupWait)
	}
	if ns.GroupInterval != nil {
		c.GroupInterval = util.Pointer(*ns.GroupInterval)
	}
	if ns.RepeatInterval != nil {
		c.RepeatInterval = util.Pointer(*ns.RepeatInterval)
	}
	if ns.GroupBy != nil {
		c.GroupBy = make([]string, len(ns.GroupBy))
		copy(c.GroupBy, ns.GroupBy)
	}
	if ns.MuteTimeIntervals != nil {
		c.MuteTimeIntervals = make([]string, len(ns.MuteTimeIntervals))
		copy(c.MuteTimeIntervals, ns.MuteTimeIntervals)
	}
	if ns.ActiveTimeIntervals != nil {
		c.ActiveTimeIntervals = make([]string, len(ns.ActiveTimeIntervals))
		copy(c.ActiveTimeIntervals, ns.ActiveTimeIntervals)
	}
	for _, mutator := range mutators {
		mutator(&c)
	}
	return c
}

// NotificationSettingsGen generates NotificationSettings using a base and mutators.
func NotificationSettingsGen(mutators ...Mutator[NotificationSettings]) func() NotificationSettings {
	return func() NotificationSettings {
		c := NotificationSettings{
			Receiver:            util.GenerateShortUID(),
			GroupBy:             []string{model.AlertNameLabel, FolderTitleLabel, util.GenerateShortUID()},
			GroupWait:           util.Pointer(model.Duration(time.Duration(rand.Intn(100)+1) * time.Second)),
			GroupInterval:       util.Pointer(model.Duration(time.Duration(rand.Intn(100)+1) * time.Second)),
			RepeatInterval:      util.Pointer(model.Duration(time.Duration(rand.Intn(100)+1) * time.Second)),
			MuteTimeIntervals:   []string{util.GenerateShortUID(), util.GenerateShortUID()},
			ActiveTimeIntervals: []string{util.GenerateShortUID(), util.GenerateShortUID()},
		}
		for _, mutator := range mutators {
			mutator(&c)
		}
		return c
	}
}

type NotificationSettingsMutators struct{}

func (n NotificationSettingsMutators) WithReceiver(receiver string) Mutator[NotificationSettings] {
	return func(ns *NotificationSettings) {
		ns.Receiver = receiver
	}
}

func (n NotificationSettingsMutators) WithGroupWait(groupWait *time.Duration) Mutator[NotificationSettings] {
	return func(ns *NotificationSettings) {
		if groupWait == nil {
			ns.GroupWait = nil
			return
		}
		dur := model.Duration(*groupWait)
		ns.GroupWait = &dur
	}
}

func (n NotificationSettingsMutators) WithGroupInterval(groupInterval *time.Duration) Mutator[NotificationSettings] {
	return func(ns *NotificationSettings) {
		if groupInterval == nil {
			ns.GroupInterval = nil
			return
		}
		dur := model.Duration(*groupInterval)
		ns.GroupInterval = &dur
	}
}

func (n NotificationSettingsMutators) WithRepeatInterval(repeatInterval *time.Duration) Mutator[NotificationSettings] {
	return func(ns *NotificationSettings) {
		if repeatInterval == nil {
			ns.RepeatInterval = nil
			return
		}
		dur := model.Duration(*repeatInterval)
		ns.RepeatInterval = &dur
	}
}

func (n NotificationSettingsMutators) WithGroupBy(groupBy ...string) Mutator[NotificationSettings] {
	return func(ns *NotificationSettings) {
		ns.GroupBy = groupBy
	}
}

func (n NotificationSettingsMutators) WithMuteTimeIntervals(muteTimeIntervals ...string) Mutator[NotificationSettings] {
	return func(ns *NotificationSettings) {
		ns.MuteTimeIntervals = muteTimeIntervals
	}
}

func (n NotificationSettingsMutators) WithActiveTimeIntervals(activeTimeIntervals ...string) Mutator[NotificationSettings] {
	return func(ns *NotificationSettings) {
		ns.ActiveTimeIntervals = activeTimeIntervals
	}
}

// Silences

// CopySilenceWith creates a deep copy of Silence and then applies mutators to it.
func CopySilenceWith(s Silence, mutators ...Mutator[Silence]) Silence {
	c := CopySilence(s)
	for _, mutator := range mutators {
		mutator(&c)
	}
	return c
}

// CopySilence creates a deep copy of Silence.
func CopySilence(s Silence) Silence {
	c := Silence{
		Silence: amv2.Silence{},
	}

	if s.ID != nil {
		c.ID = util.Pointer(*s.ID)
	}
	if s.Status != nil {
		c.Status = util.Pointer(*s.Status)
	}
	if s.UpdatedAt != nil {
		c.UpdatedAt = util.Pointer(*s.UpdatedAt)
	}
	if s.Comment != nil {
		c.Comment = util.Pointer(*s.Comment)
	}
	if s.CreatedBy != nil {
		c.CreatedBy = util.Pointer(*s.CreatedBy)
	}
	if s.EndsAt != nil {
		c.EndsAt = util.Pointer(*s.EndsAt)
	}
	if s.StartsAt != nil {
		c.StartsAt = util.Pointer(*s.StartsAt)
	}
	if s.Matchers != nil {
		c.Matchers = CopyMatchers(s.Matchers)
	}

	return c
}

// CopyMatchers creates a deep copy of Matchers.
func CopyMatchers(matchers []*amv2.Matcher) []*amv2.Matcher {
	copies := make([]*amv2.Matcher, len(matchers))
	for i, m := range matchers {
		c := amv2.Matcher{}
		if m.IsEqual != nil {
			c.IsEqual = util.Pointer(*m.IsEqual)
		}
		if m.IsRegex != nil {
			c.IsRegex = util.Pointer(*m.IsRegex)
		}
		if m.Name != nil {
			c.Name = util.Pointer(*m.Name)
		}
		if m.Value != nil {
			c.Value = util.Pointer(*m.Value)
		}
		copies[i] = &c
	}
	return copies
}

// SilenceGen generates Silence using a base and mutators.
func SilenceGen(mutators ...Mutator[Silence]) func() Silence {
	return func() Silence {
		now := time.Now()
		c := Silence{
			ID:        util.Pointer(util.GenerateShortUID()),
			Status:    util.Pointer(amv2.SilenceStatus{State: util.Pointer(amv2.SilenceStatusStateActive)}),
			UpdatedAt: util.Pointer(strfmt.DateTime(now.Add(time.Minute))),
			Silence: amv2.Silence{
				Comment:   util.Pointer(util.GenerateShortUID()),
				CreatedBy: util.Pointer(util.GenerateShortUID()),
				StartsAt:  util.Pointer(strfmt.DateTime(now.Add(-time.Minute))),
				EndsAt:    util.Pointer(strfmt.DateTime(now.Add(time.Minute))),
				Matchers:  []*amv2.Matcher{{Name: util.Pointer(util.GenerateShortUID()), Value: util.Pointer(util.GenerateShortUID()), IsRegex: util.Pointer(false), IsEqual: util.Pointer(true)}},
			},
		}
		for _, mutator := range mutators {
			mutator(&c)
		}
		return c
	}
}

var (
	SilenceMuts = SilenceMutators{}
)

type SilenceMutators struct{}

func (n SilenceMutators) WithMatcher(name, value string, matchType labels.MatchType) Mutator[Silence] {
	return func(s *Silence) {
		m := amv2.Matcher{
			Name:    &name,
			Value:   &value,
			IsRegex: util.Pointer(matchType == labels.MatchRegexp || matchType == labels.MatchNotRegexp),
			IsEqual: util.Pointer(matchType == labels.MatchRegexp || matchType == labels.MatchEqual),
		}
		s.Matchers = append(s.Matchers, &m)
	}
}
func (n SilenceMutators) WithRuleUID(value string) Mutator[Silence] {
	return func(s *Silence) {
		name := alertingModels.RuleUIDLabel
		m := amv2.Matcher{
			Name:    &name,
			Value:   &value,
			IsRegex: util.Pointer(false),
			IsEqual: util.Pointer(true),
		}
		for _, matcher := range s.Matchers {
			if isRuleUIDMatcher(*matcher) {
				*matcher = m
				return
			}
		}
		s.Matchers = append(s.Matchers, &m)
	}
}
func (n SilenceMutators) Expired() Mutator[Silence] {
	return func(s *Silence) {
		s.EndsAt = util.Pointer(strfmt.DateTime(time.Now().Add(-time.Minute)))
	}
}

func (n SilenceMutators) WithEmptyId() Mutator[Silence] {
	return func(s *Silence) {
		s.ID = util.Pointer("")
	}
}

// Receivers

// CopyReceiverWith creates a deep copy of Receiver and then applies mutators to it.
func CopyReceiverWith(r Receiver, mutators ...Mutator[Receiver]) Receiver {
	c := r.Clone()
	for _, mutator := range mutators {
		mutator(&c)
	}
	c.Version = c.Fingerprint()
	return c
}

// ReceiverGen generates Receiver using a base and mutators.
func ReceiverGen(mutators ...Mutator[Receiver]) func() Receiver {
	return func() Receiver {
		name := util.GenerateShortUID()
		integration := IntegrationGen(IntegrationMuts.WithName(name))()
		c := Receiver{
			UID:          nameToUid(name),
			Name:         name,
			Integrations: []*Integration{&integration},
			Provenance:   ProvenanceNone,
		}
		for _, mutator := range mutators {
			mutator(&c)
		}
		c.Version = c.Fingerprint()
		return c
	}
}

var (
	ReceiverMuts = ReceiverMutators{}
)

type ReceiverMutators struct{}

func (n ReceiverMutators) WithName(name string) Mutator[Receiver] {
	return func(r *Receiver) {
		r.Name = name
		r.UID = nameToUid(name)
	}
}

func (n ReceiverMutators) WithProvenance(provenance Provenance) Mutator[Receiver] {
	return func(r *Receiver) {
		r.Provenance = provenance
	}
}

func (n ReceiverMutators) WithValidIntegration(integrationType string) Mutator[Receiver] {
	return func(r *Receiver) {
		// TODO add support for v0
		integration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()
		r.Integrations = []*Integration{&integration}
	}
}

func (n ReceiverMutators) WithInvalidIntegration(integrationType string) Mutator[Receiver] {
	return func(r *Receiver) {
		// TODO add support for v0
		integration := IntegrationGen(IntegrationMuts.WithInvalidConfig(integrationType))()
		r.Integrations = []*Integration{&integration}
	}
}

func (n ReceiverMutators) WithIntegrations(integration ...Integration) Mutator[Receiver] {
	return func(r *Receiver) {
		integrations := make([]*Integration, len(integration))
		for i, v := range integration {
			clone := v.Clone()
			integrations[i] = &clone
		}
		r.Integrations = integrations
	}
}

func (n ReceiverMutators) Encrypted(fn EncryptFn) Mutator[Receiver] {
	return func(r *Receiver) {
		_ = r.Encrypt(fn)
	}
}
func (n ReceiverMutators) Decrypted(fn DecryptFn) Mutator[Receiver] {
	return func(r *Receiver) {
		_ = r.Decrypt(fn)
	}
}

// Integrations

// CopyIntegrationWith creates a deep copy of Integration and then applies mutators to it.
func CopyIntegrationWith(r Integration, mutators ...Mutator[Integration]) Integration {
	c := r.Clone()
	for _, mutator := range mutators {
		mutator(&c)
	}
	return c
}

// IntegrationGen generates Integration using a base and mutators.
func IntegrationGen(mutators ...Mutator[Integration]) func() Integration {
	return func() Integration {
		name := util.GenerateShortUID()
		randomIntegrationType, _ := randomMapKey(alertingNotify.AllKnownConfigsForTesting)

		c := Integration{
			UID:                   util.GenerateShortUID(),
			Name:                  name,
			DisableResolveMessage: rand.Intn(2) == 1,
			Settings:              make(map[string]any),
			SecureSettings:        make(map[string]string),
		}

		IntegrationMuts.WithValidConfig(randomIntegrationType)(&c)

		for _, mutator := range mutators {
			mutator(&c)
		}
		return c
	}
}

var (
	IntegrationMuts = IntegrationMutators{}
	Base64Enrypt    = func(s string) (string, error) {
		return base64.StdEncoding.EncodeToString([]byte(s)), nil
	}
	Base64Decrypt = func(s string) (string, error) {
		b, err := base64.StdEncoding.DecodeString(s)
		return string(b), err
	}
)

type IntegrationMutators struct{}

func (n IntegrationMutators) WithUID(uid string) Mutator[Integration] {
	return func(s *Integration) {
		s.UID = uid
	}
}

func (n IntegrationMutators) WithName(name string) Mutator[Integration] {
	return func(s *Integration) {
		s.Name = name
	}
}

func (n IntegrationMutators) WithValidConfig(integrationType string) Mutator[Integration] {
	return func(c *Integration) {
		// TODO add support for v0 integrations
		config := alertingNotify.AllKnownConfigsForTesting[integrationType].GetRawNotifierConfig(c.Name)
		integrationConfig, _ := IntegrationConfigFromType(integrationType, nil)
		c.Config = integrationConfig

		var settings map[string]any
		_ = json.Unmarshal(config.Settings, &settings)

		c.Settings = settings

		// Decrypt secure settings over to normal settings.
		for k, v := range c.SecureSettings {
			decodeValue, _ := base64.StdEncoding.DecodeString(v)
			settings[k] = string(decodeValue)
		}
	}
}

func (n IntegrationMutators) WithInvalidConfig(integrationType string) Mutator[Integration] {
	return func(c *Integration) {
		integrationConfig, _ := IntegrationConfigFromType(integrationType, nil)
		c.Config = integrationConfig
		c.Settings = map[string]interface{}{}
		c.SecureSettings = map[string]string{}
		if integrationType == "webex" {
			// Webex passes validation without any settings but should fail with an unparsable URL.
			c.Settings["api_url"] = "(*^$*^%!@#$*()"
		}
	}
}

func (n IntegrationMutators) WithSettings(settings map[string]any) Mutator[Integration] {
	return func(c *Integration) {
		c.Settings = maps.Clone(settings)
	}
}

func (n IntegrationMutators) AddSetting(key string, val any) Mutator[Integration] {
	return func(c *Integration) {
		c.Settings[key] = val
	}
}

func (n IntegrationMutators) WithSecureSettings(secureSettings map[string]string) Mutator[Integration] {
	return func(r *Integration) {
		r.SecureSettings = maps.Clone(secureSettings)
	}
}

func (n IntegrationMutators) AddSecureSetting(key, val string) Mutator[Integration] {
	return func(r *Integration) {
		r.SecureSettings[key] = val
	}
}

func randomMapKey[K comparable, V any](m map[K]V) (K, V) {
	randIdx := rand.Intn(len(m))
	i := 0

	for key, val := range m {
		if i == randIdx {
			return key, val
		}
		i++
	}
	return *new(K), *new(V)
}

func ConvertToRecordingRule(rule *AlertRule) {
	if rule.Record == nil {
		rule.Record = &Record{}
	}
	if rule.Record.From == "" {
		rule.Record.From = rule.Condition
	}
	if rule.Record.Metric == "" {
		rule.Record.Metric = fmt.Sprintf("some_metric_%s", util.GenerateShortUID())
	}
	rule.Condition = ""
	rule.NoDataState = ""
	rule.ExecErrState = ""
	rule.For = 0
	rule.NotificationSettings = nil
	rule.MissingSeriesEvalsToResolve = nil
}

func nameToUid(name string) string { // Avoid legacy_storage.NameToUid import cycle.
	return base64.RawURLEncoding.EncodeToString([]byte(name))
}
