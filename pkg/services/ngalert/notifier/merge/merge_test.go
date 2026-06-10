package merge

import (
	"context"
	_ "embed"
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/pkg/labels"
	commoncfg "github.com/prometheus/common/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func TestReceivers(t *testing.T) {
	r := func(name string) *v1.PostableApiReceiver {
		return &v1.PostableApiReceiver{
			Receiver: definition.Receiver{
				Name: name,
			},
		}
	}

	suffix := "-dupe"

	r1 := r("r1")
	r2 := r("r2")
	r2s := r("r2" + suffix)
	r3 := r("r3")

	testCases := []struct {
		name            string
		existing        []*v1.PostableApiReceiver
		incoming        []*v1.PostableApiReceiver
		expected        []*v1.PostableApiReceiver
		expectedRenames map[string]string
		expectedAdded   []string
	}{
		{
			name: "should append copies of incoming to existing",
			existing: []*v1.PostableApiReceiver{
				r2,
			},
			incoming: []*v1.PostableApiReceiver{
				r1,
				r3,
			},
			expected: []*v1.PostableApiReceiver{
				r2,
				r1,
				r3,
			},
			expectedRenames: map[string]string{},
			expectedAdded:   []string{"r1", "r3"},
		},
		{
			name: "should rename incoming if there is existing",
			existing: []*v1.PostableApiReceiver{
				r2,
			},
			incoming: []*v1.PostableApiReceiver{
				r("r2"),
			},
			expected: []*v1.PostableApiReceiver{
				r2,
				r("r2" + suffix),
			},
			expectedRenames: map[string]string{
				"r2": "r2" + suffix,
			},
			expectedAdded: []string{"r2" + suffix},
		},
		{
			name: "should rename incoming if there is existing after dedup",
			existing: []*v1.PostableApiReceiver{
				r2,
				r2s,
			},
			incoming: []*v1.PostableApiReceiver{
				r("r2"),
			},
			expected: []*v1.PostableApiReceiver{
				r2,
				r2s,
				r("r2" + suffix + "_01"),
			},
			expectedRenames: map[string]string{
				"r2": "r2" + suffix + "_01",
			},
			expectedAdded: []string{"r2" + suffix + "_01"},
		},
		{
			name: "should keep names unique across both sets",
			existing: []*v1.PostableApiReceiver{
				r2,
				r2s,
			},
			incoming: []*v1.PostableApiReceiver{
				r("r2"),
				r("r2" + suffix + "_01"),
			},
			expected: []*v1.PostableApiReceiver{
				r2,
				r2s,
				r("r2" + suffix + "_02"),
				r("r2" + suffix + "_01"),
			},
			expectedRenames: map[string]string{
				"r2": "r2" + suffix + "_02",
			},
			expectedAdded: []string{"r2" + suffix + "_02", "r2" + suffix + "_01"},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var existingNames, incomingNames []string
			for _, r := range tc.existing {
				existingNames = append(existingNames, r.Name)
			}
			for _, r := range tc.incoming {
				incomingNames = append(incomingNames, r.Name)
			}

			actual, actualRenames, actualAdded := Receivers(tc.existing, tc.incoming, suffix)
			require.Len(t, actual, len(tc.expected))
			assert.EqualValues(t, tc.expectedRenames, actualRenames)
			assert.Equal(t, tc.expectedAdded, actualAdded)
			for i := range tc.expected {
				assert.EqualValues(t, tc.expected[i], actual[i])
				if i < len(tc.existing) {
					assert.Same(t, tc.existing[i], actual[i])
				} else {
					idx := i - len(tc.existing)
					assert.NotSame(t, tc.incoming[idx], actual[i])
				}
			}

			t.Run("items of the lists should not be changed", func(t *testing.T) {
				var names []string
				for _, r := range tc.existing {
					names = append(names, r.Name)
				}
				assert.Equal(t, existingNames, names)
				names = nil
				for _, r := range tc.incoming {
					names = append(names, r.Name)
				}
				assert.Equal(t, incomingNames, names)
			})
		})
	}
}

func TestTimeIntervals(t *testing.T) {
	ti := func(name string) v1.TimeInterval {
		return v1.TimeInterval{
			Name: name,
		}
	}
	mti := func(name string) v1.MuteTimeInterval {
		return v1.MuteTimeInterval{
			Name: name,
		}
	}

	suffix := "-dupe"

	testCases := []struct {
		name                  string
		existingMuteIntervals []v1.MuteTimeInterval
		existingTimeIntervals []v1.TimeInterval
		incomingMuteIntervals []v1.MuteTimeInterval
		incomingTimeIntervals []v1.TimeInterval
		expected              []v1.TimeInterval
		expectedRenames       map[string]string
		expectedAdded         []string
	}{
		{
			name: "should append copies of incoming to existing time intervals",
			existingMuteIntervals: []v1.MuteTimeInterval{
				mti("mti1"),
			},
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti2"),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("ti4"),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("mti3"),
			},
			expected: []v1.TimeInterval{
				ti("mti1"),
				ti("ti2"),
				ti("mti3"),
				ti("ti4"),
			},
			expectedRenames: map[string]string{},
			expectedAdded:   []string{"mti3", "ti4"},
		},
		{
			name: "should rename incoming if there is existing",
			existingMuteIntervals: []v1.MuteTimeInterval{
				mti("mti1"),
			},
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti2"),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("mti1"),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti2"),
			},
			expected: []v1.TimeInterval{
				ti("mti1"),
				ti("ti2"),
				ti("ti2" + suffix),
				ti("mti1" + suffix),
			},
			expectedRenames: map[string]string{
				"ti2":  "ti2" + suffix,
				"mti1": "mti1" + suffix,
			},
			expectedAdded: []string{"ti2" + suffix, "mti1" + suffix},
		},
		{
			name: "should rename incoming if there is existing after dedup",
			existingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti1"),
			},
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti1" + suffix),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("ti1" + suffix),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti1"),
			},
			expected: []v1.TimeInterval{
				ti("ti1"),
				ti("ti1" + suffix),
				ti("ti1" + suffix + "_01"),
				ti("ti1" + suffix + suffix),
			},
			expectedRenames: map[string]string{
				"ti1" + suffix: "ti1" + suffix + suffix,
				"ti1":          "ti1" + suffix + "_01",
			},
			expectedAdded: []string{"ti1" + suffix + "_01", "ti1" + suffix + suffix},
		},
		{
			name: "should rename dupe among incoming",
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti2"),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("ti2"),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti2"),
			},
			expected: []v1.TimeInterval{ // mute intervals have precedence over time intervals in the case of duplicates (see https://github.com/grafana/alerting/blob/85dab908dcb43f7718a638b4c3cf9c214f7e48da/notify/grafana_alertmanager.go#L676-L685)
				ti("ti2"),
				ti("ti2" + suffix),
				ti("ti2" + suffix + "_01"),
			},
			expectedRenames: map[string]string{
				"ti2": "ti2" + suffix + "_01",
			},
			expectedAdded: []string{"ti2" + suffix, "ti2" + suffix + "_01"},
		},
		{
			name: "should ensure uniqueness across existing and incoming",
			existingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti1"),
			},
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti1" + suffix),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("ti1"),
				ti("ti2"),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti1" + suffix + "_01"),
			},
			expected: []v1.TimeInterval{
				ti("ti1"),
				ti("ti1" + suffix),
				ti("ti1" + suffix + "_01"),
				ti("ti1" + suffix + "_02"),
				ti("ti2"),
			},
			expectedRenames: map[string]string{
				"ti1": "ti1" + suffix + "_02",
			},
			expectedAdded: []string{"ti1" + suffix + "_01", "ti1" + suffix + "_02", "ti2"},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var existingNames, incomingNames []string
			for _, r := range tc.existingMuteIntervals {
				existingNames = append(existingNames, r.Name)
			}
			for _, r := range tc.existingTimeIntervals {
				existingNames = append(existingNames, r.Name)
			}
			for _, r := range tc.incomingTimeIntervals {
				incomingNames = append(incomingNames, r.Name)
			}
			for _, r := range tc.incomingMuteIntervals {
				incomingNames = append(incomingNames, r.Name)
			}

			actualTimeIntervals, actualRenames, actualAdded := TimeIntervals(tc.existingMuteIntervals, tc.existingTimeIntervals, tc.incomingMuteIntervals, tc.incomingTimeIntervals, suffix)
			assert.Equal(t, tc.expected, actualTimeIntervals)
			assert.EqualValues(t, tc.expectedRenames, actualRenames)
			assert.Equal(t, tc.expectedAdded, actualAdded)

			// check that existing and incoming lists are not changed
			var names []string
			for _, r := range tc.existingMuteIntervals {
				names = append(names, r.Name)
			}
			for _, r := range tc.existingTimeIntervals {
				names = append(names, r.Name)
			}
			assert.Equal(t, existingNames, names)
			names = nil
			for _, r := range tc.incomingTimeIntervals {
				names = append(names, r.Name)
			}
			for _, r := range tc.incomingMuteIntervals {
				names = append(names, r.Name)
			}
			assert.Equal(t, incomingNames, names)
		})
	}
}

//go:embed testdata/mimir_no_intervals.yaml
var fullMimirNoIntervals string

//go:embed testdata/mimir_with_extra_receiver.yaml
var fullMimirWithExtraReceiver string

//go:embed testdata/mimir_with_only_extra_receiver.yaml
var fullMimirWithOnlyExtraReceiver string

//go:embed testdata/mimir_swapped_intervals.yaml
var fullMimirSwappedIntervals string

func load(t *testing.T, yaml string, mutate ...func(p *v1.PostableApiAlertingConfig)) *v1.PostableApiAlertingConfig {
	t.Helper()
	orig, err := definition.LoadCompat([]byte(yaml))
	require.NoError(t, err)
	p := v1.PostableApiAlertingConfigToModel(*orig)
	for _, m := range mutate {
		m(&p)
	}
	return &p
}

//go:embed testdata/grafana_config.yaml
var fullGrafanaConfig string

//go:embed testdata/mimir_config.yaml
var fullMimirConfig string

//go:embed testdata/merged_config.yaml
var fullMergedConfig string

func TestMergeExtraConfig(t *testing.T) {
	identifier := "mimir-12345"

	// withExtra wraps grafana and a raw mimir YAML string into a PostableUserConfig with ExtraConfigs.
	// Optional mutateFn can adjust the ExtraConfiguration before it's used.
	withExtra := func(t *testing.T, grafana *v1.PostableApiAlertingConfig, mimirYAML string, mutateFn ...func(*v1.ExtraConfiguration)) v1.AMConfigV1 {
		t.Helper()
		extra := v1.ExtraConfiguration{
			Identifier:         identifier,
			AlertmanagerConfig: mimirYAML,
		}
		for _, fn := range mutateFn {
			fn(&extra)
		}
		return v1.AMConfigV1{
			AlertmanagerConfig: *grafana,
			ExtraConfigs:       []v1.ExtraConfiguration{extra},
		}
	}

	buildExpectedManaged := func(t *testing.T, mimirYAML string, renames RenameResources) (v1.ManagedRoutes, map[v1.ResourceUID]v1.InhibitionRule) {
		t.Helper()
		extra := v1.ExtraConfiguration{Identifier: identifier, AlertmanagerConfig: mimirYAML}
		mcfg, err := extra.GetAlertmanagerConfig()
		require.NoError(t, err)
		route := mcfg.Route
		RenameResourceUsagesInRoutes([]*v1.Route{route}, renames)
		inhibitRules, err := BuildManagedInhibitionRules(identifier, mcfg.InhibitRules, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)
		return v1.ManagedRoutes{identifier: route}, inhibitRules
	}

	assertConfig := func(t *testing.T, expected, actual v1.AMConfigV1) {
		t.Helper()
		diff := cmp.Diff(expected, actual,
			cmpopts.IgnoreUnexported(commoncfg.ProxyConfig{}, labels.Matcher{}),
			cmpopts.SortSlices(func(a, b *labels.Matcher) bool { return a.Name < b.Name }),
			cmpopts.SortSlices(func(a, b *v1.PostableApiReceiver) bool { return a.Name < b.Name }),
			cmpopts.EquateEmpty(),
			cmp.Comparer(func(a, b definition.RawMessage) bool {
				var va, vb any
				if err := json.Unmarshal(a, &va); err != nil {
					return string(a) == string(b)
				}
				if err := json.Unmarshal(b, &vb); err != nil {
					return string(a) == string(b)
				}
				ba, _ := json.Marshal(va)
				bb, _ := json.Marshal(vb)
				return string(ba) == string(bb)
			}),
		)
		if !assert.Empty(t, diff) {
			data, err := yaml.Marshal(actual)
			require.NoError(t, err)
			t.Fatalf("YAML:\n%v", string(data))
		}
	}

	t.Run("should merge all resources, no renames", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig)
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		expectedRoutes, expectedInhibitRules := buildExpectedManaged(t, fullMimirConfig, RenameResources{})
		assertConfig(t, v1.AMConfigV1{
			AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) { p.Global = nil }),
			ManagedRoutes:      expectedRoutes,
			InhibitionRules:    expectedInhibitRules,
		}, config)
	})

	t.Run("should populate intervals by defaults", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirNoIntervals)
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		expectedRoutes, expectedInhibitRules := buildExpectedManaged(t, fullMimirNoIntervals, RenameResources{})
		assertConfig(t, v1.AMConfigV1{
			AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) { p.Global = nil }),
			ManagedRoutes:      expectedRoutes,
			InhibitionRules:    expectedInhibitRules,
		}, config)
	})

	t.Run("should rename receivers and refactor usages", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirWithExtraReceiver)
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		expectedRoutes, expectedInhibitRules := buildExpectedManaged(t, fullMimirWithExtraReceiver,
			RenameResources{Receivers: map[string]string{"grafana-default-email": "grafana-default-email" + identifier}})
		assertConfig(t, v1.AMConfigV1{
			AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) {
				p.Global = nil
				p.Receivers = append(p.Receivers, &v1.PostableApiReceiver{
					Receiver: definition.Receiver{Name: "grafana-default-email" + identifier},
				})
			}),
			ManagedRoutes:   expectedRoutes,
			InhibitionRules: expectedInhibitRules,
		}, config)
	})

	t.Run("should append index suffix if rename still collides", func(t *testing.T) {
		grafana := load(t, fullGrafanaConfig, func(p *v1.PostableApiAlertingConfig) {
			p.Receivers = append(p.Receivers, &v1.PostableApiReceiver{
				Receiver: definition.Receiver{Name: "grafana-default-email" + identifier},
			})
		})
		input := withExtra(t, grafana, fullMimirWithOnlyExtraReceiver)
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		expectedRoutes, expectedInhibitRules := buildExpectedManaged(t, fullMimirWithOnlyExtraReceiver,
			RenameResources{Receivers: map[string]string{"grafana-default-email": "grafana-default-email" + identifier + "_01"}})
		assertConfig(t, v1.AMConfigV1{
			AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) {
				p.Global = nil
				p.Receivers = append(p.Receivers,
					&v1.PostableApiReceiver{Receiver: definition.Receiver{Name: "grafana-default-email" + identifier}},
					&v1.PostableApiReceiver{Receiver: definition.Receiver{Name: "grafana-default-email" + identifier + "_01"}},
				)
			}),
			ManagedRoutes:   expectedRoutes,
			InhibitionRules: expectedInhibitRules,
		}, config)
	})

	t.Run("should rename time intervals and refactor usages", func(t *testing.T) {
		// fullMimirSwappedIntervals has mute_time_intervals=[ti-1] and time_intervals=[ti-2, mti-1],
		// intentionally swapping names to verify uniqueness is enforced across both fields.
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirSwappedIntervals)
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		expectedRoutes, expectedInhibitRules := buildExpectedManaged(t, fullMimirSwappedIntervals,
			RenameResources{TimeIntervals: map[string]string{"ti-1": "ti-1" + identifier, "mti-1": "mti-1" + identifier}})
		assertConfig(t, v1.AMConfigV1{
			AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) {
				p.Global = nil
				// Keep mti-1 and ti-1 from base; mti-2 is absent in fullMimirSwappedIntervals.
				// Incoming: mute ti-1 (renamed) → ti-1+id, time ti-2 (no conflict), time mti-1 (renamed) → mti-1+id.
				p.TimeIntervals = []v1.TimeInterval{
					p.TimeIntervals[0], // mti-1 (existing mute, folded)
					p.TimeIntervals[1], // ti-1
					{Name: "ti-1" + identifier},
					p.TimeIntervals[3], // ti-2 (incoming time, no conflict)
					{Name: "mti-1" + identifier},
				}
			}),
			ManagedRoutes:   expectedRoutes,
			InhibitionRules: expectedInhibitRules,
		}, config)
	})

	t.Run("should not modify the base Grafana config", func(t *testing.T) {
		g := load(t, fullGrafanaConfig)
		input := withExtra(t, g, fullMimirConfig)
		_, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)
		assert.Equal(t, load(t, fullGrafanaConfig), g)
	})

	t.Run("should return base config unchanged if no extra configs", func(t *testing.T) {
		input := v1.AMConfigV1{AlertmanagerConfig: *load(t, fullGrafanaConfig)}
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)
		assert.Equal(t, input, config)
	})

	t.Run("should fail if identifier is empty", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig, func(e *v1.ExtraConfiguration) {
			e.Identifier = ""
		})
		_, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.ErrorContains(t, err, "identifier is required")
	})

	t.Run("should fail if identifier conflicts with existing managed route", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig)
		input.ManagedRoutes = v1.ManagedRoutes{identifier: nil}
		_, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.ErrorContains(t, err, identifier)
	})

	t.Run("should fail if identifier is default routing tree name", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig, func(e *v1.ExtraConfiguration) {
			e.Identifier = models.DefaultRoutingTreeName
		})
		_, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.ErrorContains(t, err, models.DefaultRoutingTreeName)
	})

	t.Run("should populate stats with added resource names", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig)
		_, result, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		assert.Equal(t, identifier, result.AddedRoute)
		assert.ElementsMatch(t, []string{"recv", "recv2"}, result.AddedReceivers)
		assert.ElementsMatch(t, []string{"mti-2", "ti-2"}, result.AddedTimeIntervals)
		assert.Empty(t, result.AddedTemplates)
		assert.ElementsMatch(t, []string{"mimir-12345-imported-inhibition-rule-0000"}, result.AddedInhibitionRules)
	})

	t.Run("should report renamed receiver in stats", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirWithExtraReceiver)
		_, result, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		assert.ElementsMatch(t, []string{"recv", "recv2", "grafana-default-email" + identifier}, result.AddedReceivers)
	})

	t.Run("should report added template names in stats", func(t *testing.T) {
		templateName := "my-template"
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig, func(e *v1.ExtraConfiguration) {
			e.TemplateFiles = map[string]string{templateName: `{{ define "my-template" }}test{{ end }}`}
		})
		_, result, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		assert.Equal(t, []string{templateName}, result.AddedTemplates)
	})

	t.Run("should return empty stats when no extra configs", func(t *testing.T) {
		input := v1.AMConfigV1{AlertmanagerConfig: *load(t, fullGrafanaConfig)}
		_, result, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		assert.Equal(t, MergeResult{}, result)
	})

	t.Run("should add extra route to ManagedRoutes", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig)
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		require.Contains(t, config.ManagedRoutes, identifier)
		assert.Equal(t, "recv", config.ManagedRoutes[identifier].Receiver)
	})

	t.Run("should preserve existing managed routes in result", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig)
		input.ManagedRoutes = v1.ManagedRoutes{"existing-managed": {Receiver: "existing"}}
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		assert.Contains(t, config.ManagedRoutes, "existing-managed")
		assert.Contains(t, config.ManagedRoutes, identifier)
	})

	t.Run("should add inhibition rules to ManagedInhibitionRules with identifier scope", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig)
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		require.Len(t, config.InhibitionRules, 1)
		for _, rule := range config.InhibitionRules {
			hasSourceScope := false
			for _, m := range rule.SourceMatchers {
				if m.Label == models.NamedRouteLabel && m.Value == identifier {
					hasSourceScope = true
					break
				}
			}
			assert.True(t, hasSourceScope, "source matchers should contain identifier scope")

			hasTargetScope := false
			for _, m := range rule.TargetMatchers {
				if m.Label == models.NamedRouteLabel && m.Value == identifier {
					hasTargetScope = true
					break
				}
			}
			assert.True(t, hasTargetScope, "target matchers should contain identifier scope")
		}
	})

	t.Run("should merge templates from extra config", func(t *testing.T) {
		templateName := "my-template"
		templateContent := `{{ define "my-template" }}test{{ end }}`
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig, func(e *v1.ExtraConfiguration) {
			e.TemplateFiles = map[string]string{templateName: templateContent}
		})
		config, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.NoError(t, err)

		expectedUID := v1.TemplateUID(v1.TemplateKindMimir, templateName)
		require.Contains(t, config.Templates, expectedUID)
		assert.Equal(t, templateName, config.Templates[expectedUID].Title)
	})

	t.Run("should fail on duplicate template", func(t *testing.T) {
		templateName := "my-template"
		templateContent := `{{ define "my-template" }}test{{ end }}`
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig, func(e *v1.ExtraConfiguration) {
			e.TemplateFiles = map[string]string{templateName: templateContent}
		})
		existingUID := v1.TemplateUID(v1.TemplateKindMimir, templateName)
		input.Templates = map[v1.ResourceUID]v1.TemplateGroup{
			existingUID: v1.NewTemplateGroup(templateName, templateContent, v1.TemplateKindMimir, models.ProvenanceNone),
		}
		_, _, err := MergeExtraConfig(context.Background(), &input, models.ProvenanceConvertedPrometheus)
		require.ErrorContains(t, err, templateName)
	})
}
