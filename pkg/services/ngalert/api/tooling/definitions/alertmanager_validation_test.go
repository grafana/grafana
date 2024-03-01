package definitions

import (
	"errors"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/require"
)

func TestValidateMuteTimeInterval(t *testing.T) {
	type testCase struct {
		desc   string
		mti    MuteTimeInterval
		expMsg string
	}

	t.Run("valid interval", func(t *testing.T) {
		cases := []testCase{
			{
				desc: "nil intervals",
				mti: MuteTimeInterval{
					MuteTimeInterval: config.MuteTimeInterval{
						Name: "interval",
					},
				},
			},
			{
				desc: "empty intervals",
				mti: MuteTimeInterval{
					MuteTimeInterval: config.MuteTimeInterval{
						Name:          "interval",
						TimeIntervals: []timeinterval.TimeInterval{},
					},
				},
			},
			{
				desc: "blank interval",
				mti: MuteTimeInterval{
					MuteTimeInterval: config.MuteTimeInterval{
						Name: "interval",
						TimeIntervals: []timeinterval.TimeInterval{
							{},
						},
					},
				},
			},
			{
				desc: "simple",
				mti: MuteTimeInterval{
					MuteTimeInterval: config.MuteTimeInterval{
						Name: "interval",
						TimeIntervals: []timeinterval.TimeInterval{
							{
								Weekdays: []timeinterval.WeekdayRange{
									{
										InclusiveRange: timeinterval.InclusiveRange{
											Begin: 1,
											End:   2,
										},
									},
								},
							},
						},
					},
				},
			},
		}

		for _, c := range cases {
			t.Run(c.desc, func(t *testing.T) {
				err := c.mti.Validate()

				require.NoError(t, err)
			})
		}
	})

	t.Run("invalid interval", func(t *testing.T) {
		cases := []testCase{
			{
				desc:   "empty",
				mti:    MuteTimeInterval{},
				expMsg: "missing name",
			},
			{
				desc: "empty",
				mti: MuteTimeInterval{
					MuteTimeInterval: config.MuteTimeInterval{
						Name: "interval",
						TimeIntervals: []timeinterval.TimeInterval{
							{
								Weekdays: []timeinterval.WeekdayRange{
									{
										InclusiveRange: timeinterval.InclusiveRange{
											Begin: -1,
											End:   7,
										},
									},
								},
							},
						},
					},
				},
				expMsg: "unable to convert -1 into weekday",
			},
		}

		for _, c := range cases {
			t.Run(c.desc, func(t *testing.T) {
				err := c.mti.Validate()

				require.ErrorContains(t, err, c.expMsg)
			})
		}
	})
}

func TestValidateNotificationTemplates(t *testing.T) {
	tc := []struct {
		name       string
		template   NotificationTemplate
		expContent string
		expError   error
	}{
		{
			name: "Same template name as definition",
			template: NotificationTemplate{
				Name:       "Same name as definition",
				Template:   `{{ define "Same name as definition" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}`,
				Provenance: "test",
			},
			expContent: `{{ define "Same name as definition" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}`,
			expError:   nil,
		},
		{
			name: "Different template name than definition",
			template: NotificationTemplate{
				Name:       "Different name than definition",
				Template:   `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}`,
				Provenance: "test",
			},
			expContent: `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}`,
			expError:   nil,
		},
		{
			name: "Fix template - missing both {{ define }} and {{ end }}",
			template: NotificationTemplate{
				Name:       "Alert Instance Template",
				Template:   `Firing: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}`,
				Provenance: "test",
			},
			expContent: "{{ define \"Alert Instance Template\" }}\n  Firing: {{ .Labels.alertname }}\\nSilence: {{ .SilenceURL }}\n{{ end }}",
			expError:   nil,
		},
		{
			name: "Multiple definitions",
			template: NotificationTemplate{
				Name:       "Alert Instance Template",
				Template:   `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}{{ define "Alert Instance Template2" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}`,
				Provenance: "test",
			},
			expContent: `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}{{ define "Alert Instance Template2" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}`,
			expError:   nil,
		},
		{
			name: "Malformed template - missing {{ define }}",
			template: NotificationTemplate{
				Name:       "Alert Instance Template",
				Template:   `\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}`,
				Provenance: "test",
			},
			expError: errors.New("invalid template: template: Alert Instance Template:3: unexpected {{end}}"),
		},
		{
			name: "Malformed template - missing {{ end }}",
			template: NotificationTemplate{
				Name:       "Alert Instance Template",
				Template:   `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n`,
				Provenance: "test",
			},
			expError: errors.New("invalid template: template: Alert Instance Template:1: unexpected EOF"),
		},
		{
			name: "Malformed template - multiple definitions duplicate name",
			template: NotificationTemplate{
				Name:       "Alert Instance Template",
				Template:   `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}\n{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}`,
				Provenance: "test",
			},
			expError: errors.New("invalid template: template: Different name than definition:1: template: multiple definition of template \"Alert Instance Template\""),
		},
		{
			// This is fine as long as the template name is different from the definition, it just ignores the extra text.
			name: "Extra text outside definition block - different template name and definition",
			template: NotificationTemplate{
				Name:       "Different name than definition",
				Template:   `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}[what is this?]`,
				Provenance: "test",
			},
			expContent: `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}[what is this?]`,
			expError:   nil,
		},
		{
			// This is NOT fine as the template name is the same as the definition.
			// GO template parser will treat it as if it's wrapped in {{ define "Alert Instance Template" }}, thus creating a duplicate definition.
			name: "Extra text outside definition block - same template name and definition",
			template: NotificationTemplate{
				Name:       "Alert Instance Template",
				Template:   `{{ define "Alert Instance Template" }}\nFiring: {{ .Labels.alertname }}\nSilence: {{ .SilenceURL }}\n{{ end }}[what is this?]`,
				Provenance: "test",
			},
			expError: errors.New("invalid template: template: Alert Instance Template:1: template: multiple definition of template \"Alert Instance Template\""),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.template.Validate()
			if tt.expError == nil {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				return
			}

			require.Equal(t, tt.expContent, tt.template.Template)
		})
	}
}
