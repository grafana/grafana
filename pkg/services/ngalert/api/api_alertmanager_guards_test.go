package api

import (
	"testing"

	amConfig "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestCheckRoute(t *testing.T) {
	tests := []struct {
		name          string
		shouldErr     bool
		currentConfig definitions.GettableUserConfig
		newConfig     definitions.PostableUserConfig
	}{
		{
			name:          "equal configs should not error",
			shouldErr:     false,
			currentConfig: gettableRoute(t, models.ProvenanceAPI),
			newConfig:     postableRoute(t, models.ProvenanceAPI),
		},
		{
			name:          "editing a non provisioned object should not fail",
			shouldErr:     false,
			currentConfig: gettableRoute(t, models.ProvenanceNone),
			newConfig: func() definitions.PostableUserConfig {
				cfg := postableRoute(t, models.ProvenanceNone)
				cfg.AlertmanagerConfig.Route.Matchers[0].Value = "123"
				return cfg
			}(),
		},
		{
			name:          "editing a provisioned object should fail",
			shouldErr:     true,
			currentConfig: gettableRoute(t, models.ProvenanceAPI),
			newConfig: func() definitions.PostableUserConfig {
				cfg := postableRoute(t, models.ProvenanceAPI)
				cfg.AlertmanagerConfig.Route.Matchers[0].Value = "123"
				return cfg
			}(),
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := checkRoutes(test.currentConfig, test.newConfig)
			if test.shouldErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func gettableRoute(t *testing.T, provenance models.Provenance) definitions.GettableUserConfig {
	t.Helper()
	return definitions.GettableUserConfig{
		AlertmanagerConfig: definitions.GettableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Provenance: definitions.Provenance(provenance),
					Continue:   true,
					GroupBy: []model.LabelName{
						"...",
					},
					Matchers: amConfig.Matchers{
						{
							Name:  "a",
							Type:  labels.MatchEqual,
							Value: "b",
						},
					},
					Routes: []*definitions.Route{
						{
							Matchers: amConfig.Matchers{
								{
									Name:  "x",
									Type:  labels.MatchNotEqual,
									Value: "y",
								},
							},
						},
					},
				},
			},
		},
	}
}

func postableRoute(t *testing.T, provenace models.Provenance) definitions.PostableUserConfig {
	t.Helper()
	return definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Provenance: definitions.Provenance(provenace),
					Continue:   true,
					GroupBy: []model.LabelName{
						"...",
					},
					Matchers: amConfig.Matchers{
						{
							Name:  "a",
							Type:  labels.MatchEqual,
							Value: "b",
						},
					},
					Routes: []*definitions.Route{
						{
							Matchers: amConfig.Matchers{
								{
									Name:  "x",
									Type:  labels.MatchNotEqual,
									Value: "y",
								},
							},
						},
					},
				},
			},
		},
	}
}

func TestCheckTemplates(t *testing.T) {
	tests := []struct {
		name          string
		shouldErr     bool
		currentConfig definitions.GettableUserConfig
		newConfig     definitions.PostableUserConfig
	}{
		{
			name:          "equal configs should not error",
			shouldErr:     false,
			currentConfig: gettableTemplates(t, "test-1", models.ProvenanceAPI),
			newConfig:     postableTemplate(t, "test-1"),
		},
		{
			name:          "removing a non provisioned object should not fail",
			shouldErr:     false,
			currentConfig: gettableTemplates(t, "test-1", models.ProvenanceNone),
			newConfig:     definitions.PostableUserConfig{},
		},
		{
			name:          "removing a provisioned object should fail",
			shouldErr:     true,
			currentConfig: gettableTemplates(t, "test-1", models.ProvenanceAPI),
			newConfig:     definitions.PostableUserConfig{},
		},
		{
			name:          "adding a non provisioned object should not fail",
			shouldErr:     false,
			currentConfig: gettableTemplates(t, "test-1", models.ProvenanceAPI),
			newConfig:     postableTemplate(t, "test-1", "test-2"),
		},
		{
			name:          "editing a non provisioned object should not fail",
			shouldErr:     false,
			currentConfig: gettableTemplates(t, "test-1", models.ProvenanceNone),
			newConfig: func() definitions.PostableUserConfig {
				cfg := postableTemplate(t, "test-1")
				cfg.TemplateFiles["test-1"] = "some updated value"
				return cfg
			}(),
		},
		{
			name:          "editing a provisioned object should fail",
			shouldErr:     true,
			currentConfig: gettableTemplates(t, "test-1", models.ProvenanceAPI),
			newConfig: func() definitions.PostableUserConfig {
				cfg := postableTemplate(t, "test-1")
				cfg.TemplateFiles["test-1"] = "some updated value"
				return cfg
			}(),
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := checkTemplates(test.currentConfig, test.newConfig)
			if test.shouldErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func gettableTemplates(t *testing.T, name string, provenance models.Provenance) definitions.GettableUserConfig {
	t.Helper()
	return definitions.GettableUserConfig{
		TemplateFiles: map[string]string{
			name: "some-template",
		},
		TemplateFileProvenances: map[string]definitions.Provenance{
			name: definitions.Provenance(provenance),
		},
	}
}

func postableTemplate(t *testing.T, names ...string) definitions.PostableUserConfig {
	t.Helper()
	files := map[string]string{}
	for _, name := range names {
		files[name] = "some-template"
	}
	return definitions.PostableUserConfig{
		TemplateFiles: files,
	}
}

func TestCheckContactPoints(t *testing.T) {
	tests := []struct {
		name          string
		shouldErr     bool
		currentConfig []*definitions.GettableApiReceiver
		newConfig     []*definitions.PostableApiReceiver
	}{
		{
			name:      "equal configs should not error",
			shouldErr: false,
			currentConfig: []*definitions.GettableApiReceiver{
				defaultGettableReceiver(t, "test-1", models.ProvenanceAPI),
			},
			newConfig: []*definitions.PostableApiReceiver{
				defaultPostableReceiver(t, "test-1"),
			},
		},
		{
			name:      "removing a non provisioned object should not fail",
			shouldErr: false,
			currentConfig: []*definitions.GettableApiReceiver{
				defaultGettableReceiver(t, "test-1", models.ProvenanceNone),
			},
			newConfig: []*definitions.PostableApiReceiver{},
		},
		{
			name:      "removing a provisioned object should fail",
			shouldErr: true,
			currentConfig: []*definitions.GettableApiReceiver{
				defaultGettableReceiver(t, "test-1", models.ProvenanceAPI),
			},
			newConfig: []*definitions.PostableApiReceiver{},
		},
		{
			name:      "adding a non provisioned object should not fail",
			shouldErr: false,
			currentConfig: []*definitions.GettableApiReceiver{
				defaultGettableReceiver(t, "test-1", models.ProvenanceAPI),
			},
			newConfig: []*definitions.PostableApiReceiver{
				defaultPostableReceiver(t, "test-1"),
				defaultPostableReceiver(t, "test-2"),
			},
		},
		{
			name:      "editing a non provisioned object should not fail",
			shouldErr: false,
			currentConfig: []*definitions.GettableApiReceiver{
				defaultGettableReceiver(t, "test-1", models.ProvenanceNone),
			},
			newConfig: []*definitions.PostableApiReceiver{
				func() *definitions.PostableApiReceiver {
					receiver := defaultPostableReceiver(t, "test-1")
					receiver.GrafanaManagedReceivers[0].SecureSettings = map[string]string{
						"url": "newUrl",
					}
					return receiver
				}(),
			},
		},
		{
			name:      "editing secure settings of a provisioned object should fail",
			shouldErr: true,
			currentConfig: []*definitions.GettableApiReceiver{
				defaultGettableReceiver(t, "test-1", models.ProvenanceAPI),
			},
			newConfig: []*definitions.PostableApiReceiver{
				func() *definitions.PostableApiReceiver {
					receiver := defaultPostableReceiver(t, "test-1")
					receiver.GrafanaManagedReceivers[0].SecureSettings = map[string]string{
						"url": "newUrl",
					}
					return receiver
				}(),
			},
		},
		{
			name:      "editing settings of a provisioned object should fail",
			shouldErr: true,
			currentConfig: []*definitions.GettableApiReceiver{
				defaultGettableReceiver(t, "test-1", models.ProvenanceAPI),
			},
			newConfig: []*definitions.PostableApiReceiver{
				func() *definitions.PostableApiReceiver {
					receiver := defaultPostableReceiver(t, "test-1")
					receiver.GrafanaManagedReceivers[0].Settings = definitions.RawMessage(`{ "hello": "data", "data": { "test": "test"}}`)
					return receiver
				}(),
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := checkContactPoints(&logtest.Fake{}, test.currentConfig, test.newConfig)
			if test.shouldErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func defaultGettableReceiver(t *testing.T, uid string, provenance models.Provenance) *definitions.GettableApiReceiver {
	t.Helper()
	return &definitions.GettableApiReceiver{
		GettableGrafanaReceivers: definitions.GettableGrafanaReceivers{
			GrafanaManagedReceivers: []*definitions.GettableGrafanaReceiver{
				{
					UID:                   "123",
					Name:                  "yeah",
					Type:                  "slack",
					DisableResolveMessage: true,
					Provenance:            definitions.Provenance(provenance),
					SecureFields: map[string]bool{
						"url": true,
					},
					Settings: definitions.RawMessage(`{
						"hello": "world",
						"data": {}
					}`),
				},
			},
		},
	}
}

func defaultPostableReceiver(t *testing.T, uid string) *definitions.PostableApiReceiver {
	t.Helper()
	return &definitions.PostableApiReceiver{
		PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
			GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
				{
					UID:                   "123",
					Name:                  "yeah",
					Type:                  "slack",
					DisableResolveMessage: true,
					Settings: definitions.RawMessage(`{
						"hello": "world",
						"data" : {}
					}`),
				},
			},
		},
	}
}

func TestCheckMuteTimes(t *testing.T) {
	tests := []struct {
		name          string
		shouldErr     bool
		currentConfig definitions.GettableUserConfig
		newConfig     definitions.PostableUserConfig
	}{
		{
			name:      "equal configs should not error",
			shouldErr: false,
			currentConfig: gettableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name:          "test-1",
						TimeIntervals: defaultInterval(t),
					},
					{
						Name:          "test-2",
						TimeIntervals: defaultInterval(t),
					},
				},
				map[string]definitions.Provenance{
					"test-1": definitions.Provenance(models.ProvenanceNone),
				}),
			newConfig: postableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name:          "test-1",
						TimeIntervals: defaultInterval(t),
					},
					{
						Name:          "test-2",
						TimeIntervals: defaultInterval(t),
					},
				}),
		},
		{
			name:      "removing a non provisioned object should not fail",
			shouldErr: false,
			currentConfig: gettableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name:          "test-1",
						TimeIntervals: defaultInterval(t),
					},
				},
				map[string]definitions.Provenance{
					"test-1": definitions.Provenance(models.ProvenanceNone),
				}),
			newConfig: postableMuteIntervals(t, []amConfig.MuteTimeInterval{}),
		},
		{
			name:      "removing a provisioned object should fail",
			shouldErr: true,
			currentConfig: gettableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name:          "test-1",
						TimeIntervals: defaultInterval(t),
					},
					{
						Name:          "test-2",
						TimeIntervals: defaultInterval(t),
					},
				},
				map[string]definitions.Provenance{
					"test-1": definitions.Provenance(models.ProvenanceAPI),
				}),
			newConfig: postableMuteIntervals(t, []amConfig.MuteTimeInterval{
				{
					Name:          "test-2",
					TimeIntervals: defaultInterval(t),
				},
			}),
		},
		{
			name:      "adding a non provisioned object should not fail",
			shouldErr: false,
			currentConfig: gettableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name:          "test-1",
						TimeIntervals: defaultInterval(t),
					},
				},
				map[string]definitions.Provenance{
					"test-1": definitions.Provenance(models.ProvenanceNone),
				}),
			newConfig: postableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name:          "test-1",
						TimeIntervals: defaultInterval(t),
					},
					{
						Name:          "test-2",
						TimeIntervals: defaultInterval(t),
					},
				}),
		},
		{
			name:      "editing a non provisioned object should not fail",
			shouldErr: false,
			currentConfig: gettableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name:          "test-1",
						TimeIntervals: defaultInterval(t),
					},
				},
				map[string]definitions.Provenance{
					"test-1": definitions.Provenance(models.ProvenanceNone),
				}),
			newConfig: postableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name: "test-1",
						TimeIntervals: func() []timeinterval.TimeInterval {
							intervals := defaultInterval(t)
							intervals[0].Times = []timeinterval.TimeRange{
								{
									StartMinute: 10,
									EndMinute:   50,
								},
							}
							return intervals
						}(),
					},
				}),
		},
		{
			name:      "editing a provisioned object should fail",
			shouldErr: true,
			currentConfig: gettableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name:          "test-1",
						TimeIntervals: defaultInterval(t),
					},
				},
				map[string]definitions.Provenance{
					"test-1": definitions.Provenance(models.ProvenanceAPI),
				}),
			newConfig: postableMuteIntervals(t,
				[]amConfig.MuteTimeInterval{
					{
						Name: "test-1",
						TimeIntervals: func() []timeinterval.TimeInterval {
							intervals := defaultInterval(t)
							intervals[0].Times = []timeinterval.TimeRange{
								{
									StartMinute: 10,
									EndMinute:   50,
								},
							}
							return intervals
						}(),
					},
				}),
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := checkMuteTimes(test.currentConfig, test.newConfig)
			if test.shouldErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func gettableMuteIntervals(t *testing.T, muteTimeIntervals []amConfig.MuteTimeInterval, provenances map[string]definitions.Provenance) definitions.GettableUserConfig {
	return definitions.GettableUserConfig{
		AlertmanagerConfig: definitions.GettableApiAlertingConfig{
			MuteTimeProvenances: provenances,
			Config: definitions.Config{
				MuteTimeIntervals: muteTimeIntervals,
			},
		},
	}
}

func postableMuteIntervals(t *testing.T, muteTimeIntervals []amConfig.MuteTimeInterval) definitions.PostableUserConfig {
	t.Helper()
	return definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				MuteTimeIntervals: muteTimeIntervals,
			},
		},
	}
}

func defaultInterval(t *testing.T) []timeinterval.TimeInterval {
	t.Helper()
	return []timeinterval.TimeInterval{
		{
			Years: []timeinterval.YearRange{
				{
					InclusiveRange: timeinterval.InclusiveRange{
						Begin: 2002,
						End:   2008,
					},
				},
			},
			Times: []timeinterval.TimeRange{
				{
					StartMinute: 10,
					EndMinute:   40,
				},
			},
			Weekdays: []timeinterval.WeekdayRange{
				{
					InclusiveRange: timeinterval.InclusiveRange{
						Begin: 1,
						End:   5,
					},
				},
			},
			DaysOfMonth: []timeinterval.DayOfMonthRange{
				{
					InclusiveRange: timeinterval.InclusiveRange{
						Begin: 1,
						End:   20,
					},
				},
			},
			Months: []timeinterval.MonthRange{
				{
					InclusiveRange: timeinterval.InclusiveRange{
						Begin: 1,
						End:   6,
					},
				},
			},
		},
	}
}
