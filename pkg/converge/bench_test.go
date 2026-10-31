package converge_test

import (
	"fmt"
	"testing"

	"context"

	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/converge/apply"
)

// fleet builds a realistic shape: n entities spread over a three-level folder
// tree, roughly 20 per leaf folder.
func fleet(n int) ([]converge.Declaration, []converge.Observation) {
	decls := make([]converge.Declaration, 0, n)
	obs := make([]converge.Observation, 0, n+n/20)
	containers := map[converge.Key]bool{}

	for i := 0; i < n; i++ {
		key := converge.Key(fmt.Sprintf("team%02d/svc%03d/dash%04d.json", i%50, (i/50)%200, i))
		fp := converge.Fingerprint(fmt.Sprintf("fp%d", i))
		decls = append(decls, converge.Declaration{Key: key, Fingerprint: fp})

		// Three quarters already held and unchanged, so the plan is mostly
		// no-ops — the steady state a resync actually sees.
		if i%4 != 0 {
			obs = append(obs, converge.Observation{
				Key: key, Identity: converge.Identity(fmt.Sprintf("uid%d", i)), Fingerprint: fp,
			})
		}
		for _, a := range key.Ancestors() {
			if !containers[a] {
				containers[a] = true
				obs = append(obs, converge.Observation{Key: a, Identity: converge.Identity("auto:" + string(a)), Container: true})
			}
		}
	}
	return decls, obs
}

func benchConfig() converge.ContainerConfig {
	return converge.ContainerConfig{
		Implied:          true,
		FallbackIdentity: func(k converge.Key) converge.Identity { return converge.Identity("auto:" + string(k)) },
	}
}

func BenchmarkNewPlan(b *testing.B) {
	for _, n := range []int{1_000, 10_000, 100_000} {
		decls, obs := fleet(n)
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if _, err := converge.NewPlan(decls, obs, converge.WithContainers(benchConfig())); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkNewPlanFromEmpty(b *testing.B) {
	// The worst case for container materialisation: every folder has to be
	// created and every entity written.
	for _, n := range []int{1_000, 10_000, 100_000} {
		decls, _ := fleet(n)
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if _, err := converge.NewPlan(decls, nil, converge.WithContainers(benchConfig())); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkNewPlanTeardown(b *testing.B) {
	// The worst case for ordering: every entity and every container goes, so
	// the removal edges are at their densest.
	for _, n := range []int{1_000, 10_000, 100_000} {
		_, obs := fleet(n)
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if _, err := converge.NewPlan(nil, obs, converge.WithContainers(benchConfig())); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkRestrict(b *testing.B) {
	for _, n := range []int{1_000, 10_000, 100_000} {
		decls, _ := fleet(n)
		p, err := converge.NewPlan(decls, nil, converge.WithContainers(benchConfig()))
		if err != nil {
			b.Fatal(err)
		}
		vetoes := []converge.Veto{{Ref: p.Ops[0].Ref(), Reason: "test"}}
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if _, err := converge.Restrict(p, vetoes); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func BenchmarkApply(b *testing.B) {
	for _, n := range []int{10_000, 100_000} {
		decls, obs := fleet(n)
		p, err := converge.NewPlan(decls, obs, converge.WithContainers(benchConfig()))
		if err != nil {
			b.Fatal(err)
		}
		noop := apply.ActuatorFunc(func(context.Context, converge.Op) error { return nil })
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if _, err := apply.Run(context.Background(), p, noop, apply.Config{Workers: 16}); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

// Capacity edges are per create per deletion, so a budget over a large fleet is
// the shape that could make ordering quadratic.
func BenchmarkNewPlanUnderBudget(b *testing.B) {
	for _, n := range []int{1_000, 10_000} {
		decls, _ := fleet(n)
		_, obs := fleet(n)
		b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if _, err := converge.NewPlan(decls, obs,
					converge.WithContainers(benchConfig()),
					converge.WithBudget(converge.Budget{MaxEntities: n / 2}),
				); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}
