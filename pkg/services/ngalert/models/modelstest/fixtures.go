package modelstest

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"maps"
	"math/rand"
	"slices"
	"sync"
	"testing"
	"time"
	"uuid"

	"github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/go-openapi/strfmt"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/notifytest"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/webex"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

var (
	RuleMuts     = AlertRuleMutators{}
	NSMuts       = NotificationSettingsMutators{}
	CPRMuts      = ContactPointRoutingMutators{}
	InstanceMuts = AlertInstanceMutators{}
	RuleGen      = &AlertRuleGenerator{
		mutators: []AlertRuleMutator{
			RuleMuts.WithUniqueUID(), RuleMuts.WithUniqueTitle(),
		},
	}
)

type AlertRuleMutator func(r *models.AlertRule)

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

func (g *AlertRuleGenerator) Generate() models.AlertRule {
	randNoDataState := func() models.NoDataState {
		s := [...]models.NoDataState{
			models.Alerting,
			models.NoData,
			models.OK,
		}
		return s[rand.Intn(len(s))]
	}

	randErrState := func() models.ExecutionErrorState {
		s := [...]models.ExecutionErrorState{
			models.AlertingErrState,
			models.ErrorErrState,
			models.OkErrState,
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

	var ns *models.NotificationSettings
	if rand.Int63()%2 == 0 {
		ns = new(NotificationSettingsGen()())
		if rand.Int63()%2 == 0 {
			// Use PolicyRouting instead.
			ns.ContactPointRouting = nil
			ns.PolicyRouting = new(PolicyRoutingGen()())
		}
	}

	var updatedBy *models.UserUID
	if rand.Int63()%2 == 0 {
		updatedBy = new(models.UserUID(util.GenerateShortUID()))
	}

	rule := models.AlertRule{
		ID:                          0,
		GUID:                        uuid.NewV4().String(),
		OrgID:                       rand.Int63n(1500) + 1, // Prevent OrgID=0 as this does not pass alert rule validation.
		Title:                       fmt.Sprintf("title-%s", util.GenerateShortUID()),
		Condition:                   "A",
		Data:                        []models.AlertQuery{g.GenerateQuery()},
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
		MissingSeriesEvalsToResolve: new(int64(2)),
	}

	for _, mutator := range g.mutators {
		mutator(&rule)
	}
	return rule
}

func (g *AlertRuleGenerator) GenerateRef() *models.AlertRule {
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

func (g *AlertRuleGenerator) GenerateMany(bounds ...int) []models.AlertRule {
	count := g.getCount(bounds...)
	result := make([]models.AlertRule, 0, count)
	for range count {
		result = append(result, g.Generate())
	}
	return result
}

func (g *AlertRuleGenerator) GenerateManyRef(bounds ...int) []*models.AlertRule {
	count := g.getCount(bounds...)

	result := make([]*models.AlertRule, 0, count)
	for range count {
		r := g.Generate()
		result = append(result, &r)
	}
	return result
}

type AlertRuleMutators struct {
}

func (a *AlertRuleMutators) WithNotEmptyLabels(count int, prefix string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.Labels = GenerateAlertLabels(count, prefix)
	}
}

func (a *AlertRuleMutators) WithUniqueID() AlertRuleMutator {
	ids := sync.Map{}
	return func(rule *models.AlertRule) {
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
	return func(rule *models.AlertRule) {
		rule.Metadata.EditorSettings.SimplifiedQueryAndExpressionsSection = enabled
	}
}

func (a *AlertRuleMutators) WithEditorSettingsSimplifiedNotificationsSection(enabled bool) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.Metadata.EditorSettings.SimplifiedNotificationsSection = enabled
	}
}

func (a *AlertRuleMutators) WithPrometheusOriginalRuleDefinition(definition string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.Metadata.PrometheusStyleRule = &models.PrometheusStyleRule{
			OriginalRuleDefinition: definition,
		}
	}
}

func (a *AlertRuleMutators) WithGroupIndex(groupIndex int) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.RuleGroupIndex = groupIndex
	}
}

func (a *AlertRuleMutators) WithUniqueGroupIndex() AlertRuleMutator {
	usedIdx := sync.Map{}
	return func(rule *models.AlertRule) {
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
	return func(rule *models.AlertRule) {
		m.Lock()
		defer m.Unlock()
		rule.RuleGroupIndex = idx
		idx++
	}
}

func (a *AlertRuleMutators) WithOrgID(orgId int64) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.OrgID = orgId
	}
}

func (a *AlertRuleMutators) WithUniqueOrgID() AlertRuleMutator {
	orgs := sync.Map{}
	return func(rule *models.AlertRule) {
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
	return func(rule *models.AlertRule) {
		for {
			if !slices.Contains(exclude, rule.NamespaceUID) {
				return
			}
			rule.NamespaceUID = util.GenerateShortUID()
		}
	}
}

func (a *AlertRuleMutators) WithNamespaceUID(namespaceUID string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.NamespaceUID = namespaceUID
	}
}

func (a *AlertRuleMutators) WithNamespace(namespace *folder.FolderReference) AlertRuleMutator {
	return a.WithNamespaceUID(namespace.UID)
}

func (a *AlertRuleMutators) WithInterval(interval time.Duration) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.IntervalSeconds = int64(interval.Seconds())
	}
}

func (a *AlertRuleMutators) WithIntervalSeconds(seconds int64) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.IntervalSeconds = seconds
	}
}

// WithIntervalMatching mutator that generates random interval and `for` duration that are multiples of the provided base interval.
func (a *AlertRuleMutators) WithIntervalMatching(baseInterval time.Duration) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.IntervalSeconds = int64(baseInterval.Seconds()) * (rand.Int63n(10) + 1)
		rule.For = time.Duration(rule.IntervalSeconds*rand.Int63n(9)+1) * time.Second
	}
}

func (a *AlertRuleMutators) WithIntervalBetween(min, max int64) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.IntervalSeconds = rand.Int63n(max-min) + min
	}
}

func (a *AlertRuleMutators) WithTitle(title string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.Title = title
	}
}

func (a *AlertRuleMutators) WithFor(duration time.Duration) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.For = duration
	}
}

func (a *AlertRuleMutators) WithForNTimes(timesOfInterval int64) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.For = time.Duration(rule.IntervalSeconds*timesOfInterval) * time.Second
	}
}

func (a *AlertRuleMutators) WithKeepFiringFor(interval time.Duration) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.KeepFiringFor = interval
	}
}

func (a *AlertRuleMutators) WithKeepFiringForNTimes(timesOfInterval int64) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.KeepFiringFor = time.Duration(rule.IntervalSeconds*timesOfInterval) * time.Second
	}
}

func (a *AlertRuleMutators) WithNoDataExecAs(nodata models.NoDataState) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.NoDataState = nodata
	}
}

func (a *AlertRuleMutators) WithErrorExecAs(err models.ExecutionErrorState) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.ExecErrState = err
	}
}

func (a *AlertRuleMutators) WithAnnotations(lbls data.Labels) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.Annotations = lbls
	}
}

func (a *AlertRuleMutators) WithAnnotation(key, value string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		if rule.Annotations == nil {
			rule.Annotations = data.Labels{}
		}
		rule.Annotations[key] = value
	}
}

func (a *AlertRuleMutators) WithLabels(lbls data.Labels) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.Labels = lbls
	}
}

func (a *AlertRuleMutators) WithLabel(key, value string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		if rule.Labels == nil {
			rule.Labels = data.Labels{}
		}
		rule.Labels[key] = value
	}
}

func (a *AlertRuleMutators) WithDashboardAndPanel(dashboardUID *string, panelID *int64) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.DashboardUID = dashboardUID
		rule.PanelID = panelID
	}
}

// WithDataSourceUID takes a list of UIDs. It adds the nth UID to the nth query in the alert (same index).
// If there are not enough queries, it adds an empty one with the given data source UID.
func (a *AlertRuleMutators) WithDataSourceUID(dsUIDs ...string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		for i, uid := range dsUIDs {
			if i >= len(rule.Data) {
				rule.Data = append(rule.Data, models.AlertQuery{
					DatasourceUID: uid,
				})
				continue
			}
			rule.Data[i].DatasourceUID = uid
		}
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
	return func(rule *models.AlertRule) {
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
	return func(rule *models.AlertRule) {
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

func (a *AlertRuleMutators) WithQuery(query ...models.AlertQuery) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.Data = query
		if len(query) > 1 {
			rule.Condition = query[0].RefID
		}
	}
}

func (a *AlertRuleMutators) WithGroupName(groupName string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.RuleGroup = groupName
	}
}

func (a *AlertRuleMutators) WithGroupPrefix(prefix string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.RuleGroup = fmt.Sprintf("%s%s", prefix, util.GenerateShortUID())
	}
}

func (a *AlertRuleMutators) WithGroupKey(groupKey models.AlertRuleGroupKey) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.RuleGroup = groupKey.RuleGroup
		rule.OrgID = groupKey.OrgID
		rule.NamespaceUID = groupKey.NamespaceUID
	}
}

// WithSameGroup generates a random group name and assigns it to all rules passed to it
func (a *AlertRuleMutators) WithSameGroup() AlertRuleMutator {
	once := sync.Once{}
	name := ""
	return func(rule *models.AlertRule) {
		once.Do(func() {
			name = util.GenerateShortUID()
		})
		rule.RuleGroup = name
	}
}

func (a *AlertRuleMutators) WithMissingSeriesEvalsToResolve(timesOfInterval int64) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		if timesOfInterval <= 0 {
			panic("timesOfInterval must be greater than 0")
		}
		rule.MissingSeriesEvalsToResolve = new(timesOfInterval)
	}
}

func (a *AlertRuleMutators) WithNotificationSettingsGen(ns func() models.NotificationSettings) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.NotificationSettings = new(ns())
	}
}

func (a *AlertRuleMutators) WithNotificationSettings(ns models.NotificationSettings) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.NotificationSettings = &ns
	}
}

func (a *AlertRuleMutators) WithContactPointRouting(ns models.ContactPointRouting) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.NotificationSettings = new(models.NotificationSettingsFromContact(ns))
	}
}

func (a *AlertRuleMutators) WithPolicyRouting(pr models.PolicyRouting) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.NotificationSettings = new(models.NotificationSettingsFromPolicy(pr.Policy))
	}
}

func (a *AlertRuleMutators) WithNoNotificationSettings() AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.NotificationSettings = nil
	}
}

func (a *AlertRuleMutators) WithIsPaused(paused bool) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		rule.IsPaused = paused
	}
}

func (a *AlertRuleMutators) WithRandomRecordingRules() AlertRuleMutator {
	return func(rule *models.AlertRule) {
		if rand.Int63()%2 == 0 {
			return
		}
		ConvertToRecordingRule(rule)
	}
}

func (a *AlertRuleMutators) WithAllRecordingRules() AlertRuleMutator {
	return func(rule *models.AlertRule) {
		ConvertToRecordingRule(rule)
	}
}

func (a *AlertRuleMutators) WithoutTargetDataSource() AlertRuleMutator {
	return func(rule *models.AlertRule) {
		if rule.Record != nil {
			rule.Record.TargetDatasourceUID = ""
		}
	}
}

func (a *AlertRuleMutators) WithMetric(metric string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		if rule.Record == nil {
			rule.Record = &models.Record{}
		}
		rule.Record.Metric = metric
	}
}

func (a *AlertRuleMutators) WithRecordFrom(from string) AlertRuleMutator {
	return func(rule *models.AlertRule) {
		if rule.Record == nil {
			rule.Record = &models.Record{}
		}
		rule.Record.From = from
	}
}

func (a *AlertRuleMutators) WithUpdatedBy(uid *models.UserUID) AlertRuleMutator {
	return func(r *models.AlertRule) {
		r.UpdatedBy = uid
	}
}

func (a *AlertRuleMutators) WithUID(uid string) AlertRuleMutator {
	return func(r *models.AlertRule) {
		r.UID = uid
	}
}

func (a *AlertRuleMutators) WithKey(key models.AlertRuleKey) AlertRuleMutator {
	return func(r *models.AlertRule) {
		r.UID = key.UID
		r.OrgID = key.OrgID
	}
}

func (a *AlertRuleMutators) WithVersion(version int64) AlertRuleMutator {
	return func(r *models.AlertRule) {
		r.Version = version
	}
}

func (a *AlertRuleMutators) WithMetadata(meta models.AlertRuleMetadata) AlertRuleMutator {
	return func(r *models.AlertRule) {
		r.Metadata = meta
	}
}

func (a AlertRuleMutators) WithGUID(guid string) AlertRuleMutator {
	return func(r *models.AlertRule) {
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

func GenerateAlertQuery() models.AlertQuery {
	return RuleGen.GenerateQuery()
}

func (g *AlertRuleGenerator) GenerateQuery() models.AlertQuery {
	f := rand.Intn(10) + 5
	t := rand.Intn(f)

	return models.AlertQuery{
		DatasourceUID: util.GenerateShortUID(),
		Model: json.RawMessage(fmt.Sprintf(`{
			"%s": "%s",
			"%s":"%d"
		}`, util.GenerateShortUID(), util.GenerateShortUID(), util.GenerateShortUID(), rand.Int())),
		RelativeTimeRange: models.RelativeTimeRange{
			From: models.Duration(time.Duration(f) * time.Minute),
			To:   models.Duration(time.Duration(t) * time.Minute),
		},
		RefID:     util.GenerateShortUID(),
		QueryType: util.GenerateShortUID(),
	}
}

func (g *AlertRuleGenerator) WithCondition(condition string) AlertRuleMutator {
	return func(r *models.AlertRule) {
		r.Condition = condition
	}
}

// GenerateRuleKey generates a random alert rule key
func GenerateRuleKey(orgID int64) models.AlertRuleKey {
	return models.AlertRuleKey{
		OrgID: orgID,
		UID:   util.GenerateShortUID(),
	}
}

// GenerateRuleKeyWithGroup generates a random alert rule key with group
func GenerateRuleKeyWithGroup(orgID int64) models.AlertRuleKeyWithGroup {
	return models.AlertRuleKeyWithGroup{
		AlertRuleKey: GenerateRuleKey(orgID),
		RuleGroup:    util.GenerateShortUID(),
	}
}

// GenerateGroupKey generates a random group key
func GenerateGroupKey(orgID int64) models.AlertRuleGroupKey {
	return models.AlertRuleGroupKey{
		OrgID:        orgID,
		NamespaceUID: util.GenerateShortUID(),
		RuleGroup:    util.GenerateShortUID(),
	}
}

// CopyRule creates a deep copy of AlertRule
func CopyRule(r *models.AlertRule, mutators ...AlertRuleMutator) *models.AlertRule {
	result := r.Copy()
	if len(mutators) > 0 {
		for _, mutator := range mutators {
			mutator(result)
		}
	}
	return result
}

func CreateClassicConditionExpression(refID string, inputRefID string, reducer string, operation string, threshold int) models.AlertQuery {
	return models.AlertQuery{
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

func CreateReduceExpression(refID string, inputRefID string, reducer string) models.AlertQuery {
	return models.AlertQuery{
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

func CreatePrometheusQuery(refID string, expr string, intervalMs int64, maxDataPoints int64, isInstant bool, datasourceUID string) models.AlertQuery {
	return models.AlertQuery{
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

func CreateLokiQuery(refID string, expr string, intervalMs int64, maxDataPoints int64, queryType string, datasourceUID string) models.AlertQuery {
	return models.AlertQuery{
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

func CreateHysteresisExpression(t *testing.T, refID string, inputRefID string, threshold int, recoveryThreshold int) models.AlertQuery {
	t.Helper()
	q := models.AlertQuery{
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

func GenerateMetadata() models.AlertRuleMetadata {
	return models.AlertRuleMetadata{
		EditorSettings: models.EditorSettings{
			SimplifiedQueryAndExpressionsSection: rand.Int()%2 == 0,
			SimplifiedNotificationsSection:       rand.Int()%2 == 0,
		},
	}
}

type AlertInstanceMutator func(*models.AlertInstance)

// AlertInstanceGen provides a factory function that generates a random AlertInstance.
// The mutators arguments allows changing fields of the resulting structure.
func AlertInstanceGen(mutators ...AlertInstanceMutator) *models.AlertInstance {
	var labels map[string]string = nil
	if rand.Int63()%2 == 0 {
		labels = GenerateAlertLabels(rand.Intn(5), "lbl-")
	}

	randState := func() models.InstanceStateType {
		s := [...]models.InstanceStateType{
			models.InstanceStateFiring,
			models.InstanceStateNormal,
			models.InstanceStatePending,
			models.InstanceStateNoData,
			models.InstanceStateError,
			models.InstanceStateRecovering,
		}
		return s[rand.Intn(len(s))]
	}

	currentStateSince := time.Now().Add(-time.Duration(rand.Intn(100) + 1))

	instance := &models.AlertInstance{
		AlertInstanceKey: models.AlertInstanceKey{
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
		LastSentAt:        new(time.Now().Add(-time.Duration(rand.Intn(100) + 50))),
	}

	if instance.CurrentState == models.InstanceStateNormal && rand.Intn(2) == 1 {
		instance.ResolvedAt = new(time.Now().Add(-time.Duration(rand.Intn(100) + 50)))
	}

	for _, mutator := range mutators {
		mutator(instance)
	}
	return instance
}

type AlertInstanceMutators struct{}

func (a AlertInstanceMutators) WithOrgID(orgID int64) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.RuleOrgID = orgID
	}
}

func (a AlertInstanceMutators) WithRuleUID(ruleUID string) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.RuleUID = ruleUID
	}
}

func (a AlertInstanceMutators) WithLabelsHash(hash string) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.LabelsHash = hash
	}
}

func (a AlertInstanceMutators) WithReason(reason string) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.CurrentReason = reason
	}
}

func (a AlertInstanceMutators) WithState(state models.InstanceStateType) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.CurrentState = state
	}
}

func (a AlertInstanceMutators) WithLabels(labels models.InstanceLabels) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.Labels = labels
	}
}

func (a AlertInstanceMutators) WithAnnotations(annotations models.InstanceAnnotations) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.Annotations = annotations
	}
}

func (a AlertInstanceMutators) WithResultFingerprint(fp string) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.ResultFingerprint = fp
	}
}

func (a AlertInstanceMutators) WithLastError(lastError string) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.LastError = lastError
	}
}

func (a AlertInstanceMutators) WithLastResult(lastResult models.LastResult) AlertInstanceMutator {
	return func(i *models.AlertInstance) {
		i.LastResult = lastResult
	}
}

type Mutator[T any] func(*T)

// CopyContactPointRouting creates a deep copy of ContactPointRouting.
func CopyContactPointRouting(ns models.ContactPointRouting, mutators ...Mutator[models.ContactPointRouting]) models.ContactPointRouting {
	c := models.CopyContactPointRouting(ns)
	for _, mutator := range mutators {
		mutator(&c)
	}
	return c
}

// ContactPointRoutingGen generates ContactPointRouting using a base and mutators.
func ContactPointRoutingGen(mutators ...Mutator[models.ContactPointRouting]) func() models.ContactPointRouting {
	return func() models.ContactPointRouting {
		c := models.ContactPointRouting{
			Receiver:            util.GenerateShortUID(),
			GroupBy:             []string{model.AlertNameLabel, models.FolderTitleLabel, util.GenerateShortUID()},
			GroupWait:           new(model.Duration(time.Duration(rand.Intn(100)+1) * time.Second)),
			GroupInterval:       new(model.Duration(time.Duration(rand.Intn(100)+1) * time.Second)),
			RepeatInterval:      new(model.Duration(time.Duration(rand.Intn(100)+1) * time.Second)),
			MuteTimeIntervals:   []string{util.GenerateShortUID(), util.GenerateShortUID()},
			ActiveTimeIntervals: []string{util.GenerateShortUID(), util.GenerateShortUID()},
		}
		for _, mutator := range mutators {
			mutator(&c)
		}
		return c
	}
}

type ContactPointRoutingMutators struct{}

func (n ContactPointRoutingMutators) WithReceiver(receiver string) Mutator[models.ContactPointRouting] {
	return func(ns *models.ContactPointRouting) {
		ns.Receiver = receiver
	}
}

func (n ContactPointRoutingMutators) WithGroupWait(groupWait *time.Duration) Mutator[models.ContactPointRouting] {
	return func(ns *models.ContactPointRouting) {
		if groupWait == nil {
			ns.GroupWait = nil
			return
		}
		dur := model.Duration(*groupWait)
		ns.GroupWait = &dur
	}
}

func (n ContactPointRoutingMutators) WithGroupInterval(groupInterval *time.Duration) Mutator[models.ContactPointRouting] {
	return func(ns *models.ContactPointRouting) {
		if groupInterval == nil {
			ns.GroupInterval = nil
			return
		}
		dur := model.Duration(*groupInterval)
		ns.GroupInterval = &dur
	}
}

func (n ContactPointRoutingMutators) WithRepeatInterval(repeatInterval *time.Duration) Mutator[models.ContactPointRouting] {
	return func(ns *models.ContactPointRouting) {
		if repeatInterval == nil {
			ns.RepeatInterval = nil
			return
		}
		dur := model.Duration(*repeatInterval)
		ns.RepeatInterval = &dur
	}
}

func (n ContactPointRoutingMutators) WithGroupBy(groupBy ...string) Mutator[models.ContactPointRouting] {
	return func(ns *models.ContactPointRouting) {
		ns.GroupBy = groupBy
	}
}

func (n ContactPointRoutingMutators) WithMuteTimeIntervals(muteTimeIntervals ...string) Mutator[models.ContactPointRouting] {
	return func(ns *models.ContactPointRouting) {
		ns.MuteTimeIntervals = muteTimeIntervals
	}
}

func (n ContactPointRoutingMutators) WithActiveTimeIntervals(activeTimeIntervals ...string) Mutator[models.ContactPointRouting] {
	return func(ns *models.ContactPointRouting) {
		ns.ActiveTimeIntervals = activeTimeIntervals
	}
}

// PolicyRoutingGen generates PolicyRouting using a base and mutators.
func PolicyRoutingGen(mutators ...Mutator[models.PolicyRouting]) func() models.PolicyRouting {
	return func() models.PolicyRouting {
		c := models.PolicyRouting{
			Policy: util.GenerateShortUID(),
		}
		for _, mutator := range mutators {
			mutator(&c)
		}
		return c
	}
}

// CopyNotificationSettings creates a deep copy of NotificationSettings.
func CopyNotificationSettings(ns models.NotificationSettings, mutators ...Mutator[models.NotificationSettings]) models.NotificationSettings {
	c := models.CopyNotificationSettings(ns)
	for _, mutator := range mutators {
		mutator(&c)
	}
	return c
}

// NotificationSettingsGen generates NotificationSettings using a base and mutators.
func NotificationSettingsGen(mutators ...Mutator[models.NotificationSettings]) func() models.NotificationSettings {
	return func() models.NotificationSettings {
		c := ContactPointRoutingGen()()
		ns := models.NotificationSettings{
			ContactPointRouting: &c,
		}
		for _, mutator := range mutators {
			mutator(&ns)
		}
		return ns
	}
}

type NotificationSettingsMutators struct{}

func (n NotificationSettingsMutators) WithReceiver(receiver string) Mutator[models.NotificationSettings] {
	return func(ns *models.NotificationSettings) {
		if ns.ContactPointRouting == nil {
			ns.ContactPointRouting = &models.ContactPointRouting{}
		}
		CPRMuts.WithReceiver(receiver)(ns.ContactPointRouting)
	}
}

func (n NotificationSettingsMutators) WithGroupWait(groupWait *time.Duration) Mutator[models.NotificationSettings] {
	return func(ns *models.NotificationSettings) {
		if ns.ContactPointRouting == nil {
			ns.ContactPointRouting = &models.ContactPointRouting{}
		}
		CPRMuts.WithGroupWait(groupWait)(ns.ContactPointRouting)
	}
}

func (n NotificationSettingsMutators) WithGroupInterval(groupInterval *time.Duration) Mutator[models.NotificationSettings] {
	return func(ns *models.NotificationSettings) {
		if ns.ContactPointRouting == nil {
			ns.ContactPointRouting = &models.ContactPointRouting{}
		}
		CPRMuts.WithGroupInterval(groupInterval)(ns.ContactPointRouting)
	}
}

func (n NotificationSettingsMutators) WithRepeatInterval(repeatInterval *time.Duration) Mutator[models.NotificationSettings] {
	return func(ns *models.NotificationSettings) {
		if ns.ContactPointRouting == nil {
			ns.ContactPointRouting = &models.ContactPointRouting{}
		}
		CPRMuts.WithRepeatInterval(repeatInterval)(ns.ContactPointRouting)
	}
}

func (n NotificationSettingsMutators) WithGroupBy(groupBy ...string) Mutator[models.NotificationSettings] {
	return func(ns *models.NotificationSettings) {
		if ns.ContactPointRouting == nil {
			ns.ContactPointRouting = &models.ContactPointRouting{}
		}
		CPRMuts.WithGroupBy(groupBy...)(ns.ContactPointRouting)
	}
}

func (n NotificationSettingsMutators) WithMuteTimeIntervals(muteTimeIntervals ...string) Mutator[models.NotificationSettings] {
	return func(ns *models.NotificationSettings) {
		if ns.ContactPointRouting == nil {
			ns.ContactPointRouting = &models.ContactPointRouting{}
		}
		CPRMuts.WithMuteTimeIntervals(muteTimeIntervals...)(ns.ContactPointRouting)
	}
}

func (n NotificationSettingsMutators) WithActiveTimeIntervals(activeTimeIntervals ...string) Mutator[models.NotificationSettings] {
	return func(ns *models.NotificationSettings) {
		if ns.ContactPointRouting == nil {
			ns.ContactPointRouting = &models.ContactPointRouting{}
		}
		CPRMuts.WithActiveTimeIntervals(activeTimeIntervals...)(ns.ContactPointRouting)
	}
}

func (n NotificationSettingsMutators) WithPolicy(policy string) Mutator[models.NotificationSettings] {
	return func(ns *models.NotificationSettings) {
		if ns.PolicyRouting == nil {
			ns.PolicyRouting = &models.PolicyRouting{}
		}
		ns.PolicyRouting.Policy = policy
	}
}

// Silences

// CopySilenceWith creates a deep copy of Silence and then applies mutators to it.
func CopySilenceWith(s models.Silence, mutators ...Mutator[models.Silence]) models.Silence {
	c := CopySilence(s)
	for _, mutator := range mutators {
		mutator(&c)
	}
	return c
}

// CopySilence creates a deep copy of Silence.
func CopySilence(s models.Silence) models.Silence {
	c := models.Silence{
		Silence: amv2.Silence{},
	}

	if s.ID != nil {
		c.ID = new(*s.ID)
	}
	if s.Status != nil {
		c.Status = new(*s.Status)
	}
	if s.UpdatedAt != nil {
		c.UpdatedAt = new(*s.UpdatedAt)
	}
	if s.Comment != nil {
		c.Comment = new(*s.Comment)
	}
	if s.CreatedBy != nil {
		c.CreatedBy = new(*s.CreatedBy)
	}
	if s.EndsAt != nil {
		c.EndsAt = new(*s.EndsAt)
	}
	if s.StartsAt != nil {
		c.StartsAt = new(*s.StartsAt)
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
			c.IsEqual = new(*m.IsEqual)
		}
		if m.IsRegex != nil {
			c.IsRegex = new(*m.IsRegex)
		}
		if m.Name != nil {
			c.Name = new(*m.Name)
		}
		if m.Value != nil {
			c.Value = new(*m.Value)
		}
		copies[i] = &c
	}
	return copies
}

// SilenceGen generates Silence using a base and mutators.
func SilenceGen(mutators ...Mutator[models.Silence]) func() models.Silence {
	return func() models.Silence {
		now := time.Now() //nolint:staticcheck // SA4006: lint seems wrong, now IS used
		c := models.Silence{
			ID:        new(util.GenerateShortUID()),
			Status:    new(amv2.SilenceStatus{State: new(amv2.SilenceStatusStateActive)}),
			UpdatedAt: new(strfmt.DateTime(now.Add(time.Minute))),
			Silence: amv2.Silence{
				Comment:   new(util.GenerateShortUID()),
				CreatedBy: new(util.GenerateShortUID()),
				StartsAt:  new(strfmt.DateTime(now.Add(-time.Minute))),
				EndsAt:    new(strfmt.DateTime(now.Add(time.Minute))),
				Matchers:  []*amv2.Matcher{{Name: new(util.GenerateShortUID()), Value: new(util.GenerateShortUID()), IsRegex: new(false), IsEqual: new(true)}},
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

func (n SilenceMutators) WithMatcher(name, value string, matchType labels.MatchType) Mutator[models.Silence] {
	return func(s *models.Silence) {
		m := amv2.Matcher{
			Name:    &name,
			Value:   &value,
			IsRegex: new(matchType == labels.MatchRegexp || matchType == labels.MatchNotRegexp),
			IsEqual: new(matchType == labels.MatchRegexp || matchType == labels.MatchEqual),
		}
		s.Matchers = append(s.Matchers, &m)
	}
}
func (n SilenceMutators) WithRuleUID(value string) Mutator[models.Silence] {
	return func(s *models.Silence) {
		name := alertingModels.RuleUIDLabel
		m := amv2.Matcher{
			Name:    &name,
			Value:   &value,
			IsRegex: new(false),
			IsEqual: new(true),
		}
		for _, matcher := range s.Matchers {
			if (matcher.IsEqual == nil || *matcher.IsEqual) && (matcher.IsRegex == nil || !*matcher.IsRegex) && matcher.Name != nil && *matcher.Name == name {
				*matcher = m
				return
			}
		}
		s.Matchers = append(s.Matchers, &m)
	}
}
func (n SilenceMutators) Expired() Mutator[models.Silence] {
	return func(s *models.Silence) {
		s.EndsAt = new(strfmt.DateTime(time.Now().Add(-time.Minute)))
	}
}

func (n SilenceMutators) WithEmptyId() Mutator[models.Silence] {
	return func(s *models.Silence) {
		s.ID = new("")
	}
}

// Receivers

// CopyReceiverWith creates a deep copy of Receiver and then applies mutators to it.
func CopyReceiverWith(r models.Receiver, mutators ...Mutator[models.Receiver]) models.Receiver {
	c := r.Clone()
	for _, mutator := range mutators {
		mutator(&c)
	}
	c.Version = c.Fingerprint()
	return c
}

// ReceiverGen generates Receiver using a base and mutators.
func ReceiverGen(mutators ...Mutator[models.Receiver]) func() models.Receiver {
	return func() models.Receiver {
		name := util.GenerateShortUID()
		integration := IntegrationGen(IntegrationMuts.WithName(name))()
		c := models.Receiver{
			UID:          util.GenerateShortUID(),
			Name:         name,
			Integrations: []*models.Integration{&integration},
			Provenance:   models.ProvenanceNone,
			Origin:       models.ResourceOriginGrafana,
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

func (n ReceiverMutators) WithName(name string) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		r.Name = name
	}
}

func (n ReceiverMutators) WithProvenance(provenance models.Provenance) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		r.Provenance = provenance
	}
}

func (n ReceiverMutators) WithValidIntegration(integrationType schema.IntegrationType) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		// TODO add support for v0
		integration := IntegrationGen(IntegrationMuts.WithValidConfig(integrationType))()
		r.Integrations = []*models.Integration{&integration}
	}
}

func (n ReceiverMutators) WithInvalidIntegration(integrationType schema.IntegrationType) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		// TODO add support for v0
		integration := IntegrationGen(IntegrationMuts.WithInvalidConfig(integrationType))()
		r.Integrations = []*models.Integration{&integration}
	}
}

func (n ReceiverMutators) WithIntegrations(integration ...models.Integration) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		integrations := make([]*models.Integration, len(integration))
		for i, v := range integration {
			clone := v.Clone()
			integrations[i] = &clone
		}
		r.Integrations = integrations
	}
}

func (n ReceiverMutators) Encrypted(fn models.EncryptFn) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		_ = r.Encrypt(fn)
	}
}
func (n ReceiverMutators) Decrypted(fn models.DecryptFn) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		_ = r.Decrypt(fn)
	}
}

func (n ReceiverMutators) WithOrigin(origin models.ResourceOrigin) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		r.Origin = origin
	}
}

func (n ReceiverMutators) WithEmptyIntegrations() Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		r.Integrations = []*models.Integration{}
	}
}

func (n ReceiverMutators) WithUID(uid string) Mutator[models.Receiver] {
	return func(r *models.Receiver) {
		r.UID = uid
	}
}

// Integrations

// CopyIntegrationWith creates a deep copy of Integration and then applies mutators to it.
func CopyIntegrationWith(r models.Integration, mutators ...Mutator[models.Integration]) models.Integration {
	c := r.Clone()
	for _, mutator := range mutators {
		mutator(&c)
	}
	return c
}

// IntegrationGen generates Integration using a base and mutators.
func IntegrationGen(mutators ...Mutator[models.Integration]) func() models.Integration {
	return func() models.Integration {
		name := util.GenerateShortUID()
		randomIntegrationType, _ := randomMapKey(notifytest.AllKnownV1ConfigsForTesting)

		c := models.Integration{
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

func (n IntegrationMutators) WithUID(uid string) Mutator[models.Integration] {
	return func(s *models.Integration) {
		s.UID = uid
	}
}

func (n IntegrationMutators) WithName(name string) Mutator[models.Integration] {
	return func(s *models.Integration) {
		s.Name = name
	}
}

func (n IntegrationMutators) WithValidConfig(integrationType schema.IntegrationType) Mutator[models.Integration] {
	return n.WithValidConfigVersion(integrationType, schema.V1)
}

// WithValidConfigVersion sets a valid configuration for the given integration type and schema version.
func (n IntegrationMutators) WithValidConfigVersion(integrationType schema.IntegrationType, version schema.Version) Mutator[models.Integration] {
	return func(c *models.Integration) {
		ncfg, ok := notifytest.AllKnownConfigsForTesting[notifytest.IntegrationVersionKey{Type: integrationType, Version: version}]
		if !ok {
			panic(fmt.Sprintf("unknown integration type/version: %s/%s", integrationType, version))
		}
		config := ncfg.GetRawNotifierConfig(c.Name)
		c.Config, _ = alertingNotify.GetSchemaVersionForIntegration(integrationType, version)

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

func (n IntegrationMutators) WithInvalidConfig(integrationType schema.IntegrationType) Mutator[models.Integration] {
	return func(c *models.Integration) {
		var ok bool
		c.Config, ok = alertingNotify.GetSchemaVersionForIntegration(integrationType, schema.V1)
		if !ok {
			panic(fmt.Sprintf("unknown integration type: %s", integrationType))
		}
		c.Settings = map[string]interface{}{}
		c.SecureSettings = map[string]string{}
		if integrationType == webex.Type {
			// Webex passes validation without any settings but should fail with an unparsable URL.
			c.Settings["api_url"] = "(*^$*^%!@#$*()"
		}
	}
}

func (n IntegrationMutators) WithSettings(settings map[string]any) Mutator[models.Integration] {
	return func(c *models.Integration) {
		c.Settings = maps.Clone(settings)
	}
}

func (n IntegrationMutators) AddSetting(key string, val any) Mutator[models.Integration] {
	return func(c *models.Integration) {
		c.Settings[key] = val
	}
}

func (n IntegrationMutators) WithSecureSettings(secureSettings map[string]string) Mutator[models.Integration] {
	return func(r *models.Integration) {
		r.SecureSettings = maps.Clone(secureSettings)
	}
}

func (n IntegrationMutators) AddSecureSetting(key, val string) Mutator[models.Integration] {
	return func(r *models.Integration) {
		r.SecureSettings[key] = val
	}
}

func (n IntegrationMutators) RemoveSetting(key string) Mutator[models.Integration] {
	return func(c *models.Integration) {
		delete(c.Settings, key)
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

func ConvertToRecordingRule(rule *models.AlertRule) {
	if rule.Record == nil {
		rule.Record = &models.Record{}
	}
	if rule.Record.From == "" {
		rule.Record.From = rule.Condition
	}
	if rule.Record.Metric == "" {
		rule.Record.Metric = fmt.Sprintf("some_metric_%s", util.GenerateShortUID())
	}
	if rule.Record.TargetDatasourceUID == "" {
		rule.Record.TargetDatasourceUID = util.GenerateShortUID()
	}
	rule.Condition = ""
	rule.NoDataState = ""
	rule.ExecErrState = ""
	rule.For = 0
	rule.KeepFiringFor = 0
	rule.NotificationSettings = nil
	rule.MissingSeriesEvalsToResolve = nil
}
