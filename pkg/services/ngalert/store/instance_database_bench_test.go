package store_test

import (
	"context"
	"flag"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

var saveStateCompressed = flag.Bool("save-state-compressed", false, "Save state compressed")

func BenchmarkSaveAlertInstances(b *testing.B) {
	ctx := context.Background()

	opts := []tests.TestEnvOption{}
	if *saveStateCompressed {
		opts = append(opts, tests.WithFeatureToggles(
			featuremgmt.WithFeatures(featuremgmt.FlagAlertingSaveStateCompressed)),
		)
	}

	benchmarkRun := func(b *testing.B, instanceCount, labelCount int) {
		ng, dbstore := tests.SetupTestEnv(b, baseIntervalSeconds, opts...)

		const mainOrgID int64 = 1

		alertRule := tests.CreateTestAlertRule(b, ctx, dbstore, 60, mainOrgID)

		// Create some instances to write down and then delete.
		instances := make([]models.AlertInstance, 0, instanceCount)
		keys := make([]models.AlertInstanceKey, 0, instanceCount)
		for i := 0; i < instanceCount; i++ {
			labels := models.InstanceLabels{"instance": fmt.Sprintf("instance-%d", i)}
			for li := 0; li < labelCount; li++ {
				labels[fmt.Sprintf("label-%d", li)] = fmt.Sprintf("value-%d", li)
			}
			_, labelsHash, _ := labels.StringAndHash()

			instance := models.AlertInstance{
				AlertInstanceKey: models.AlertInstanceKey{
					RuleOrgID:  alertRule.OrgID,
					RuleUID:    alertRule.UID,
					LabelsHash: labelsHash,
				},
				CurrentState:  models.InstanceStateFiring,
				CurrentReason: string(models.InstanceStateError),
				Labels:        labels,
			}
			instances = append(instances, instance)
			keys = append(keys, instance.AlertInstanceKey)
		}

		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			var err error

			if *saveStateCompressed {
				err = ng.InstanceStore.SaveAlertInstancesForRule(ctx, alertRule.GetKeyWithGroup(), instances)
				if err != nil {
					b.Fatalf("error: %s", err)
				}

				// Clean up instances.
				b.StopTimer()
				err = ng.InstanceStore.DeleteAlertInstancesByRule(ctx, alertRule.GetKeyWithGroup())
				if err != nil {
					b.Fatalf("error: %s", err)
				}
				b.StartTimer()
			} else {
				for _, instance := range instances {
					err = ng.InstanceStore.SaveAlertInstance(ctx, instance)
					if err != nil {
						b.Fatalf("error: %s", err)
					}
				}

				// Clean up instances.
				b.StopTimer()
				err = ng.InstanceStore.DeleteAlertInstances(ctx, keys...)
				if err != nil {
					b.Fatalf("error: %s", err)
				}
				b.StartTimer()
			}
		}
	}

	b.Run("100 instances with 10 labels each", func(b *testing.B) {
		benchmarkRun(b, 100, 10)
	})

	b.Run("100 instances with 100 labels each", func(b *testing.B) {
		benchmarkRun(b, 100, 100)
	})

	b.Run("1000 instances with 10 labels each", func(b *testing.B) {
		benchmarkRun(b, 1000, 10)
	})
}
