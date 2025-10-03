package store

import (
	"fmt"
	"testing"
	"time"

	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// jsonBench is used for benchmark tests to use the same json library as production code
var jsonBench = jsoniter.ConfigCompatibleWithStandardLibrary

// generateTestAlertRules creates a slice of alertRule structs with realistic JSON data for benchmarking
func generateTestAlertRules(count int) []alertRule {
	rules := make([]alertRule, count)

	// Sample JSON data that mimics real alert rules
	dataJSON := `[{"refId":"A","queryType":"","model":{"expr":"up","refId":"A"},"datasourceUid":"prometheus-uid","intervalMs":1000,"maxDataPoints":43200}]`
	labelsJSON := `{"severity":"critical","team":"backend"}`
	annotationsJSON := `{"description":"Instance is down","summary":"{{ $labels.instance }} is down"}`
	notificationSettingsJSON := `[{"receiver":"grafana-default-email"}]`
	metadataJSON := `{}`

	for i := 0; i < count; i++ {
		rules[i] = alertRule{
			ID:                          int64(i + 1),
			GUID:                        fmt.Sprintf("guid-%d", i),
			OrgID:                       1,
			Title:                       fmt.Sprintf("Test Alert Rule %d", i),
			Condition:                   "A",
			Data:                        dataJSON,
			Updated:                     time.Now(),
			IntervalSeconds:             60,
			Version:                     1,
			UID:                         fmt.Sprintf("uid-%d", i),
			NamespaceUID:                fmt.Sprintf("folder-%d", i%10), // 10 folders
			RuleGroup:                   fmt.Sprintf("group-%d", i%5),   // 5 groups per folder
			RuleGroupIndex:              i % 10,
			Record:                      "",
			NoDataState:                 "NoData",
			ExecErrState:                "Alerting",
			For:                         5 * time.Minute,
			KeepFiringFor:               0,
			Annotations:                 annotationsJSON,
			Labels:                      labelsJSON,
			IsPaused:                    false,
			NotificationSettings:        notificationSettingsJSON,
			Metadata:                    metadataJSON,
			MissingSeriesEvalsToResolve: nil,
		}
	}

	return rules
}

// convertAlertRulesSequential is the original sequential implementation for comparison
func (st DBstore) convertAlertRulesSequential(rawRules []alertRule, query *ngmodels.ListAlertRulesExtendedQuery, groupsSet map[string]struct{}) []*ngmodels.AlertRule {
	alertRules := make([]*ngmodels.AlertRule, 0, len(rawRules))

	for _, rule := range rawRules {
		converted, err := alertRuleToModelsAlertRule(rule, st.Logger)
		if err != nil {
			st.Logger.Error("Invalid rule found in DB store, cannot convert, ignoring it", "func", "convertAlertRulesSequential", "error", err)
			continue
		}

		// Apply post-conversion filters
		if !shouldIncludeRule(&converted, query, groupsSet) {
			continue
		}

		alertRules = append(alertRules, &converted)
	}

	return alertRules
}

// BenchmarkConvertAlertRulesSequential benchmarks the original sequential conversion
func BenchmarkConvertAlertRulesSequential(b *testing.B) {
	sizes := []int{100, 1000, 10000, 40000, 120000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("rules=%d", size), func(b *testing.B) {
			// Setup
			store := DBstore{
				Logger: &logtest.Fake{},
			}
			rules := generateTestAlertRules(size)
			query := &ngmodels.ListAlertRulesExtendedQuery{}
			groupsSet := make(map[string]struct{})

			// Reset timer to exclude setup time
			b.ResetTimer()

			// Run benchmark
			for i := 0; i < b.N; i++ {
				_ = store.convertAlertRulesSequential(rules, query, groupsSet)
			}
		})
	}
}

// BenchmarkConvertAlertRulesParallel benchmarks the new parallel conversion
func BenchmarkConvertAlertRulesParallel(b *testing.B) {
	sizes := []int{100, 1000, 10000, 40000, 120000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("rules=%d", size), func(b *testing.B) {
			// Setup
			store := DBstore{
				Logger: &logtest.Fake{},
			}
			rules := generateTestAlertRules(size)
			query := &ngmodels.ListAlertRulesExtendedQuery{}
			groupsSet := make(map[string]struct{})

			// Reset timer to exclude setup time
			b.ResetTimer()

			// Run benchmark
			for i := 0; i < b.N; i++ {
				_ = store.convertAlertRulesInParallel(rules, query, groupsSet)
			}
		})
	}
}

// BenchmarkConvertAlertRulesComparison runs both versions side-by-side for easy comparison
func BenchmarkConvertAlertRulesComparison(b *testing.B) {
	// Test with a realistic large dataset
	const ruleCount = 5000

	store := DBstore{
		Logger: &logtest.Fake{},
	}
	rules := generateTestAlertRules(ruleCount)
	query := &ngmodels.ListAlertRulesExtendedQuery{}
	groupsSet := make(map[string]struct{})

	b.Run("Sequential", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = store.convertAlertRulesSequential(rules, query, groupsSet)
		}
	})

	b.Run("Parallel", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = store.convertAlertRulesInParallel(rules, query, groupsSet)
		}
	})
}

// BenchmarkConvertAlertRules40K benchmarks with 40K rules (realistic production scale)
func BenchmarkConvertAlertRules40K(b *testing.B) {
	const ruleCount = 40000

	store := DBstore{
		Logger: &logtest.Fake{},
	}
	rules := generateTestAlertRules(ruleCount)
	query := &ngmodels.ListAlertRulesExtendedQuery{}
	groupsSet := make(map[string]struct{})

	b.Run("Sequential", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = store.convertAlertRulesSequential(rules, query, groupsSet)
		}
	})

	b.Run("Parallel", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = store.convertAlertRulesInParallel(rules, query, groupsSet)
		}
	})
}

// BenchmarkConvertAlertRules120K benchmarks with 120K rules (maximum expected scale)
func BenchmarkConvertAlertRules120K(b *testing.B) {
	const ruleCount = 120000

	store := DBstore{
		Logger: &logtest.Fake{},
	}
	rules := generateTestAlertRules(ruleCount)
	query := &ngmodels.ListAlertRulesExtendedQuery{}
	groupsSet := make(map[string]struct{})

	b.Run("Sequential", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = store.convertAlertRulesSequential(rules, query, groupsSet)
		}
	})

	b.Run("Parallel", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			_ = store.convertAlertRulesInParallel(rules, query, groupsSet)
		}
	})
}

// BenchmarkJSONParsing benchmarks just the JSON parsing part to identify the bottleneck
func BenchmarkJSONParsing(b *testing.B) {
	dataJSON := `[{"refId":"A","queryType":"","model":{"expr":"up","refId":"A"},"datasourceUid":"prometheus-uid","intervalMs":1000,"maxDataPoints":43200}]`
	labelsJSON := `{"severity":"critical","team":"backend"}`
	annotationsJSON := `{"description":"Instance is down","summary":"{{ $labels.instance }} is down"}`

	b.Run("ParseData", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var data []ngmodels.AlertQuery
			_ = jsonBench.Unmarshal([]byte(dataJSON), &data)
		}
	})

	b.Run("ParseLabels", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var labels map[string]string
			_ = jsonBench.Unmarshal([]byte(labelsJSON), &labels)
		}
	})

	b.Run("ParseAnnotations", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var annotations map[string]string
			_ = jsonBench.Unmarshal([]byte(annotationsJSON), &annotations)
		}
	})

	b.Run("ParseAll", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			var data []ngmodels.AlertQuery
			var labels map[string]string
			var annotations map[string]string
			_ = jsonBench.Unmarshal([]byte(dataJSON), &data)
			_ = jsonBench.Unmarshal([]byte(labelsJSON), &labels)
			_ = jsonBench.Unmarshal([]byte(annotationsJSON), &annotations)
		}
	})
}
