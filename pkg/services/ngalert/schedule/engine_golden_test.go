package schedule

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// The tests in this file pin today's scheduler behaviour with literal values, so a later refactor
// (the engine rule type) can prove it did not change them. The expected values were recorded by running
// the tests on unmodified main. Do not update them to make a refactor pass.

func goldenQueries() []models.AlertQuery {
	return []models.AlertQuery{
		{
			RefID:             "A",
			DatasourceUID:     "golden-ds",
			QueryType:         "",
			RelativeTimeRange: models.RelativeTimeRange{From: models.Duration(600 * time.Second), To: 0},
			Model:             []byte(`{"refId":"A","expr":"up"}`),
		},
		{
			RefID:             "B",
			DatasourceUID:     "__expr__",
			RelativeTimeRange: models.RelativeTimeRange{From: 0, To: 0},
			Model:             []byte(`{"refId":"B","type":"math","expression":"$A > 0"}`),
		},
	}
}

func goldenAlertRule() *models.AlertRule {
	return &models.AlertRule{
		ID:              42,
		GUID:            "golden-guid",
		OrgID:           1,
		Title:           "golden alert",
		Condition:       "B",
		Data:            goldenQueries(),
		Updated:         time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC),
		IntervalSeconds: 60,
		Version:         3,
		UID:             "golden-uid",
		NamespaceUID:    "golden-folder",
		RuleGroup:       "golden-group",
		RuleGroupIndex:  1,
		NoDataState:     models.NoData,
		ExecErrState:    models.AlertingErrState,
		For:             5 * time.Minute,
		Annotations:     map[string]string{"summary": "golden"},
		Labels:          map[string]string{"severity": "critical", "team": "alerting"},
	}
}

func goldenRecordingRule() *models.AlertRule {
	r := goldenAlertRule()
	r.UID = "golden-recording-uid"
	r.Title = "golden recording"
	r.Condition = "A"
	r.Data = goldenQueries()[:1]
	r.NoDataState = models.NoData
	r.ExecErrState = models.ErrorErrState
	r.Record = &models.Record{Metric: "golden_metric", From: "A", TargetDatasourceUID: "golden-target-ds"}
	return r
}

func goldenDuration(s string) *model.Duration {
	d, err := model.ParseDuration(s)
	if err != nil {
		panic(err)
	}
	return &d
}

func TestGoldenRuleFingerprint(t *testing.T) {
	const folderTitle = "Golden Folder"

	fixtures := []struct {
		name string
		rule func() *models.AlertRule
		want string
	}{
		{"alerting rule", goldenAlertRule, "314d5f67d13e21f8"},
		{"recording rule", goldenRecordingRule, "c25f2dd966ff2bc8"},
		{"paused rule", func() *models.AlertRule {
			r := goldenAlertRule()
			r.IsPaused = true
			return r
		}, "1252985ec64ed619"},
		{"dashboard uid and panel id", func() *models.AlertRule {
			r := goldenAlertRule()
			r.DashboardUID = new("golden-dashboard")
			r.PanelID = new(int64(7))
			return r
		}, "d59df66c18723cc3"},
		{"contact point settings with default timings", func() *models.AlertRule {
			r := goldenAlertRule()
			r.NotificationSettings = &models.NotificationSettings{
				ContactPointRouting: &models.ContactPointRouting{Receiver: "golden-receiver"},
			}
			return r
		}, "8ffb0a2d6f799437"},
		{"contact point settings with non-default timings", func() *models.AlertRule {
			r := goldenAlertRule()
			r.NotificationSettings = &models.NotificationSettings{
				ContactPointRouting: &models.ContactPointRouting{
					Receiver:            "golden-receiver",
					GroupBy:             []string{"alertname", "cluster"},
					GroupWait:           goldenDuration("30s"),
					GroupInterval:       goldenDuration("5m"),
					RepeatInterval:      goldenDuration("4h"),
					MuteTimeIntervals:   []string{"mute-1"},
					ActiveTimeIntervals: []string{"active-1"},
				},
			}
			return r
		}, "9600744ffb099817"},
		{"policy settings", func() *models.AlertRule {
			r := goldenAlertRule()
			r.NotificationSettings = &models.NotificationSettings{
				PolicyRouting: &models.PolicyRouting{Policy: "golden-policy"},
			}
			return r
		}, "ce4afed80461fa49"},
		{"imported prometheus rule", func() *models.AlertRule {
			r := goldenAlertRule()
			r.Labels = map[string]string{models.ConvertedPrometheusRuleLabel: "true"}
			r.Metadata.PrometheusStyleRule = &models.PrometheusStyleRule{OriginalRuleDefinition: "alert: golden"}
			return r
		}, "8061b48b082abb9b"},
		{"sequence member", func() *models.AlertRule {
			r := goldenAlertRule()
			models.EnrichRulesWithSequenceMembership(
				[]*models.AlertRule{r},
				[]models.SchedulableRuleSequence{{UID: "golden-seq", IntervalSeconds: 120, AlertRuleRefs: []string{r.UID}}},
			)
			return r
		}, "314d5f67d13e21f8"}, // same as the plain alerting rule: sequence membership is not hashed
	}

	for _, f := range fixtures {
		t.Run(f.name, func(t *testing.T) {
			got := ruleWithFolder{rule: f.rule(), folderTitle: folderTitle}.Fingerprint().String()
			require.Equal(t, f.want, got)
		})
	}

	t.Run("fields that do not change the fingerprint", func(t *testing.T) {
		base := ruleWithFolder{rule: goldenAlertRule(), folderTitle: folderTitle}.Fingerprint()
		mutations := map[string]func(r *models.AlertRule){
			"RuleGroup":       func(r *models.AlertRule) { r.RuleGroup = "another-group" },
			"RuleGroupIndex":  func(r *models.AlertRule) { r.RuleGroupIndex = 9 },
			"IntervalSeconds": func(r *models.AlertRule) { r.IntervalSeconds = 600 },
			"Version":         func(r *models.AlertRule) { r.Version = 99 },
			"Updated":         func(r *models.AlertRule) { r.Updated = r.Updated.Add(time.Hour) },
			"UpdatedBy":       func(r *models.AlertRule) { r.UpdatedBy = new(models.UserUID("another-user")) },
		}
		for field, mutate := range mutations {
			t.Run(field, func(t *testing.T) {
				r := goldenAlertRule()
				mutate(r)
				require.Equal(t, base, ruleWithFolder{rule: r, folderTitle: folderTitle}.Fingerprint())
			})
		}
	})
}

func TestGoldenJitterOffsets(t *testing.T) {
	const baseInterval = 10 * time.Second

	// NOTE: the by-group and by-rule values are expected to change only in the final jitter commit of
	// "scheduler on the engine type", which hashes the evaluation unit key. Any other change is a regression.
	// Offsets are in ticks of baseInterval. JitterNever is always 0, so it is asserted separately.
	cases := []struct {
		orgID           int64
		group           string
		intervalSeconds int64
		byGroup, byRule int64
	}{
		{1, "group-a", 10, 0, 0},
		{1, "group-a", 60, 5, 0},
		{1, "group-a", 300, 23, 25},
		{1, "group-b", 10, 0, 0},
		{1, "group-b", 60, 0, 2},
		{1, "group-b", 300, 0, 27},
		{2, "group-a", 10, 0, 0},
		{2, "group-a", 60, 0, 5},
		{2, "group-a", 300, 18, 26},
		{2, "group-b", 10, 0, 0},
		{2, "group-b", 60, 3, 1},
		{2, "group-b", 300, 3, 18},
	}

	for _, c := range cases {
		t.Run(fmt.Sprintf("org%d/%s/%ds", c.orgID, c.group, c.intervalSeconds), func(t *testing.T) {
			r := goldenAlertRule()
			r.OrgID = c.orgID
			r.RuleGroup = c.group
			r.UID = fmt.Sprintf("jitter-%s-%d", c.group, c.intervalSeconds)
			r.IntervalSeconds = c.intervalSeconds
			require.Equal(t, int64(0), jitterOffsetInTicks(r, baseInterval, JitterNever))
			require.Equal(t, c.byGroup, jitterOffsetInTicks(r, baseInterval, JitterByGroup))
			require.Equal(t, c.byRule, jitterOffsetInTicks(r, baseInterval, JitterByRule))
		})
	}
}

// goldenSequencePlan renders what buildSequences produced for items: one line per sequence head with its
// interval and the chain of rules evaluated after it, in order.
func goldenSequencePlan(sch *schedule, items []readyToRunItem) []string {
	next := map[string]string{}
	runJobFn := func(n readyToRunItem, prev ...readyToRunItem) func() {
		next[prev[0].rule.UID] = n.rule.UID
		return func() {}
	}
	sequences := sch.buildSequences(items, runJobFn)
	plan := make([]string, 0, len(sequences))
	for _, s := range sequences {
		chain := []string{s.rule.UID}
		for uid, ok := next[s.rule.UID]; ok; uid, ok = next[uid] {
			chain = append(chain, uid)
		}
		plan = append(plan, fmt.Sprintf("%s @%ds", strings.Join(chain, "->"), s.rule.IntervalSeconds))
	}
	return plan
}

func goldenItems(rules []*models.AlertRule) []readyToRunItem {
	items := make([]readyToRunItem, 0, len(rules))
	for _, r := range rules {
		items = append(items, readyToRunItem{
			ruleRoutine: &fakeSequenceRule{UID: r.UID, Group: r.RuleGroup},
			Evaluation:  Evaluation{rule: r, folderTitle: "Golden Folder"},
		})
	}
	return items
}

func goldenGroupRule(uid, group string, index int, interval int64) *models.AlertRule {
	r := goldenAlertRule()
	r.UID = uid
	r.ID = int64(index)
	r.RuleGroup = group
	r.RuleGroupIndex = index
	r.IntervalSeconds = interval
	return r
}

func goldenImported(r *models.AlertRule) *models.AlertRule {
	r.Metadata.PrometheusStyleRule = &models.PrometheusStyleRule{OriginalRuleDefinition: "alert: golden"}
	return r
}

func TestGoldenSequencePlan(t *testing.T) {
	seqGroup := sequenceGroupName(t, "golden-seq")

	inputs := []struct {
		name  string
		build func(t *testing.T) []*models.AlertRule
		// byGroup and byRule are the plans under each jitter strategy.
		byGroup []string
		byRule  []string
	}{
		{
			name: "rule sequence store membership",
			build: func(t *testing.T) []*models.AlertRule {
				rules := []*models.AlertRule{
					goldenGroupRule("a2", "legacy-group", 1, 60),
					goldenGroupRule("a1", "legacy-group", 2, 60),
					goldenGroupRule("r1", "legacy-group", 3, 60),
					goldenGroupRule("other", "legacy-group", 4, 60),
				}
				reg := &alertRulesRegistry{}
				reg.set(rules, nil, []models.SchedulableRuleSequence{{
					UID: "golden-seq", IntervalSeconds: 120,
					RecordingRuleRefs: []string{"r1"}, AlertRuleRefs: []string{"a1", "a2"},
				}})
				got, _ := reg.all()
				return got
			},
			byGroup: []string{"other @60s", "r1->a1->a2 @120s"},
			byRule:  []string{"a1 @120s", "a2 @120s", "other @60s", "r1 @120s"},
		},
		{
			name: "sequence group names sent by the remote ruler api",
			build: func(t *testing.T) []*models.AlertRule {
				return []*models.AlertRule{
					goldenGroupRule("c3", seqGroup, 3, 120),
					goldenGroupRule("c1", seqGroup, 1, 120),
					goldenGroupRule("c2", seqGroup, 2, 120),
				}
			},
			byGroup: []string{"c1->c2->c3 @120s"},
			byRule:  []string{"c1 @120s", "c2 @120s", "c3 @120s"},
		},
		{
			name: "imported prometheus group",
			build: func(t *testing.T) []*models.AlertRule {
				return []*models.AlertRule{
					goldenImported(goldenGroupRule("p2", "prom-group", 2, 60)),
					goldenImported(goldenGroupRule("p1", "prom-group", 1, 60)),
					goldenImported(goldenGroupRule("p3", "prom-group", 3, 60)),
				}
			},
			byGroup: []string{"p1->p2->p3 @60s"},
			byRule:  []string{"p1 @60s", "p2 @60s", "p3 @60s"},
		},
		{
			name: "plain group that is not imported",
			build: func(t *testing.T) []*models.AlertRule {
				return []*models.AlertRule{
					goldenGroupRule("g1", "plain-group", 1, 60),
					goldenGroupRule("g2", "plain-group", 2, 60),
				}
			},
			byGroup: []string{"g1 @60s", "g2 @60s"},
			byRule:  []string{"g1 @60s", "g2 @60s"},
		},
		{
			name: "lone rule",
			build: func(t *testing.T) []*models.AlertRule {
				return []*models.AlertRule{goldenGroupRule("lone", "lone-group", 1, 60)}
			},
			byGroup: []string{"lone @60s"},
			byRule:  []string{"lone @60s"},
		},
		{
			name: "half converted imported group",
			build: func(t *testing.T) []*models.AlertRule {
				rules := []*models.AlertRule{
					goldenImported(goldenGroupRule("h1", "prom-group", 1, 60)),
					goldenImported(goldenGroupRule("h2", "prom-group", 2, 60)),
					goldenImported(goldenGroupRule("h3", "prom-group", 3, 60)),
					goldenImported(goldenGroupRule("h4", "prom-group", 4, 60)),
				}
				reg := &alertRulesRegistry{}
				reg.set(rules, nil, []models.SchedulableRuleSequence{{
					UID: "golden-seq", IntervalSeconds: 120, AlertRuleRefs: []string{"h2", "h1"},
				}})
				got, _ := reg.all()
				return got
			},
			byGroup: []string{"h2->h1 @120s", "h3->h4 @60s"},
			byRule:  []string{"h1 @120s", "h2 @120s", "h3 @60s", "h4 @60s"},
		},
	}

	for _, in := range inputs {
		for _, strategy := range []JitterStrategy{JitterByGroup, JitterByRule} {
			t.Run(fmt.Sprintf("%s/%s", in.name, strategy), func(t *testing.T) {
				sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
				sch.jitterEvaluations = strategy
				got := goldenSequencePlan(sch, goldenItems(in.build(t)))
				want := in.byGroup
				if strategy == JitterByRule {
					// NOTE: the by rule plans are expected to change in the final ordering commit of
					// "scheduler on the engine type", where sequences always evaluate in order.
					want = in.byRule
				}
				require.Equal(t, want, got)
			})
		}
	}
}

func TestRoutingLabelsMatchSettingsFingerprint(t *testing.T) {
	type pair struct {
		name string
		a, b *models.NotificationSettings
	}
	contactPoint := func(cpr models.ContactPointRouting) *models.NotificationSettings {
		return &models.NotificationSettings{ContactPointRouting: &cpr}
	}
	policy := func(p string) *models.NotificationSettings {
		return &models.NotificationSettings{PolicyRouting: &models.PolicyRouting{Policy: p}}
	}
	pairs := []pair{
		{"nil vs set", nil, contactPoint(models.ContactPointRouting{Receiver: "cp-a"})},
		{"nil vs policy", nil, policy("policy-a")},
		{"contact point A vs B", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), contactPoint(models.ContactPointRouting{Receiver: "cp-b"})},
		{"default vs custom group_by", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), contactPoint(models.ContactPointRouting{Receiver: "cp-a", GroupBy: []string{"alertname", "cluster"}})},
		{"default vs custom group_wait", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), contactPoint(models.ContactPointRouting{Receiver: "cp-a", GroupWait: goldenDuration("30s")})},
		{"default vs custom group_interval", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), contactPoint(models.ContactPointRouting{Receiver: "cp-a", GroupInterval: goldenDuration("5m")})},
		{"default vs custom repeat_interval", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), contactPoint(models.ContactPointRouting{Receiver: "cp-a", RepeatInterval: goldenDuration("4h")})},
		{"default vs mute time intervals", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), contactPoint(models.ContactPointRouting{Receiver: "cp-a", MuteTimeIntervals: []string{"t1"}})},
		{"default vs active time intervals", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), contactPoint(models.ContactPointRouting{Receiver: "cp-a", ActiveTimeIntervals: []string{"t1"}})},
		{"mute vs active time intervals", contactPoint(models.ContactPointRouting{Receiver: "cp-a", MuteTimeIntervals: []string{"t1"}}), contactPoint(models.ContactPointRouting{Receiver: "cp-a", ActiveTimeIntervals: []string{"t1"}})},
		{"policy A vs B", policy("policy-a"), policy("policy-b")},
		{"contact point vs policy", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), policy("policy-a")},
		{"identical", contactPoint(models.ContactPointRouting{Receiver: "cp-a"}), contactPoint(models.ContactPointRouting{Receiver: "cp-a"})},
	}

	modes := map[string]featuremgmt.FeatureToggles{
		"new simplified routing hash off": featuremgmt.WithFeatures(),
		"new simplified routing hash on":  featuremgmt.WithFeatures(featuremgmt.FlagAlertingUseNewSimplifiedRoutingHashAlgorithm),
	}
	// Pairs that are known not to be equivalent. Fingerprint(nil) always uses the new algorithm, which separates
	// mute from active time intervals, while ToLabels with the toggle off uses the old one, which does not.
	// This is pinned, not fixed: if it is ever fixed this entry must be removed.
	knownDivergent := map[string]map[string]bool{
		"new simplified routing hash off": {"mute vs active time intervals": true},
	}

	for modeName, features := range modes {
		t.Run(modeName, func(t *testing.T) {
			for _, p := range pairs {
				t.Run(p.name, func(t *testing.T) {
					fingerprintsDiffer := p.a.Fingerprint(nil) != p.b.Fingerprint(nil)
					labelsDiffer := !labelsEqual(p.a.ToLabels(features), p.b.ToLabels(features))
					if knownDivergent[modeName][p.name] {
						require.True(t, fingerprintsDiffer)
						require.False(t, labelsDiffer)
						return
					}
					require.Equal(t, fingerprintsDiffer, labelsDiffer,
						"Fingerprint(nil) differs=%v but ToLabels differs=%v", fingerprintsDiffer, labelsDiffer)
				})
			}
		})
	}
}

func labelsEqual(a, b data.Labels) bool {
	return a.String() == b.String()
}
