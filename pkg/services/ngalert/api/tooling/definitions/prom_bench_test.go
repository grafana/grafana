package definitions

import (
	"flag"
	"fmt"
	"math/rand"
	"testing"
)

var topkStrategy = flag.String("topk", "heap", "topk strategy to benchmark. choices: sort, heap")
var showComparisons = flag.Bool("show-comparisons", false, "whether to show the number of comparisons made")

func makeAlerts(amount int) []Alert {
	// A typical distribution of alert states is that most are Normal
	// and a few are Alerting, so we assume 99% Normal and 1% Alerting.
	percentAlerting := 1

	// Series will commonly have many labels.
	numLabels := 10

	alerts := make([]Alert, amount)

	for i := 0; i < len(alerts); i++ {
		lbls := make(map[string]string)
		for label := 0; label < numLabels; label++ {
			lbls[fmt.Sprintf("label_%d", label)] = fmt.Sprintf("label_%d_value_%d", label, i%100)
		}
		alerts[i].Labels = LabelsFromMap(lbls)

		if i%100 < percentAlerting {
			alerts[i].State = "alerting"
			// Should populate ActiveAt because this prevents needing label comparison
		} else {
			alerts[i].State = "normal"
		}
	}

	// Shuffle in a repeatable order to avoid any bias from the initial ordering.
	r := rand.New(rand.NewSource(1))
	r.Shuffle(len(alerts), func(i, j int) { alerts[i], alerts[j] = alerts[j], alerts[i] })

	return alerts
}

func BenchmarkSortAlertsByImportance(b *testing.B) {
	var topkFunc func(AlertsBy, []Alert, int)

	switch *topkStrategy {
	case "sort":
		topkFunc = func(by AlertsBy, alerts []Alert, limit int) {
			by.Sort(alerts)
			if len(alerts) > limit {
				_ = alerts[0:limit]
			}
		}

	case "heap":
		topkFunc = func(by AlertsBy, alerts []Alert, limit int) {
			_ = by.TopK(alerts, limit)
		}
	}

	for _, n := range []int{1000, 10000, 100000} {
		for _, k := range []int{16, 100, 1000, 100000} {
			b.Run(fmt.Sprintf("n_%d_k_%d", n, k), func(b *testing.B) {
				b.StopTimer()

				for bi := 0; bi < b.N; bi++ {
					alerts := makeAlerts(n)

					comparisons := 0
					by := func(a1, a2 *Alert) bool {
						comparisons++
						return AlertsByImportance(a1, a2)
					}

					b.StartTimer()
					topkFunc(by, alerts, k)
					b.StopTimer()

					if *showComparisons {
						fmt.Printf("Number of comparisons (strategy: %s): %d\n", *topkStrategy, comparisons)
					}
				}
			})
		}
	}
}
