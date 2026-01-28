package policy_exports

import (
	"embed"
	"time"

	"github.com/grafana/alerting/definition"
	prometheus "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
)

//go:embed exports-*
var Responses embed.FS

func routeNameToFilename(routeName string, exportType string) string {
	return "exports-" + routeName + "." + exportType
}

func ReadExportResponse(routeName string, exportType string) ([]byte, error) {
	return Responses.ReadFile(routeNameToFilename(routeName, exportType))
}

var AllRoutes = func() map[string]*definitions.Route {
	return map[string]*definitions.Route{
		"empty":            Empty(),
		"override-inherit": OverrideInherit(),
		"matcher-variety":  MatcherVariety(),
		"special-cases":    SpecialCases(),
		"deeply-nested":    DeeplyNested(),
		"user-defined":     Legacy(),
	}
}

var Config = func() *definitions.PostableUserConfig {
	return &definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: Legacy(),
				// Add time interval references to help tests avoid validation errors.
				TimeIntervals: []prometheus.TimeInterval{
					{Name: "interval"},
					{Name: "active"},
					{Name: "Some interval"},
					{Name: "A provisioned interval"},
					{Name: "Some interval override"},
					{Name: "A provisioned interval override"},
				},
			},
			// Add receiver references to help tests avoid validation errors.
			Receivers: []*definition.PostableApiReceiver{
				{Receiver: prometheus.Receiver{Name: "default-receiver"}},
				{Receiver: prometheus.Receiver{Name: "lotsa-emails"}},
				{Receiver: prometheus.Receiver{Name: "lotsa-emails-override"}},
				{Receiver: prometheus.Receiver{Name: "slack-multi-channel"}},
				{Receiver: prometheus.Receiver{Name: "provisioned-contact-point"}},
				{Receiver: prometheus.Receiver{Name: "nested-receiver"}},
			},
		},
	}
}

var Legacy = func() *definitions.Route {
	r := &definitions.Route{
		Receiver:       "default-receiver",
		GroupByStr:     []string{"g1", "g2"},
		GroupWait:      util.Pointer(model.Duration(time.Duration(30) * time.Second)),
		GroupInterval:  util.Pointer(model.Duration(time.Duration(5) * time.Minute)),
		RepeatInterval: util.Pointer(model.Duration(time.Duration(1) * time.Hour)),
		Routes: []*definitions.Route{{
			Receiver:   "nested-receiver",
			GroupByStr: []string{"g3", "g4"},
			Matchers: prometheus.Matchers{
				{
					Name:  "a",
					Type:  labels.MatchEqual,
					Value: "b",
				},
			},
			ObjectMatchers:      definitions.ObjectMatchers{{Type: 0, Name: "foo", Value: "bar"}},
			MuteTimeIntervals:   []string{"interval"},
			ActiveTimeIntervals: []string{"active"},
			Continue:            true,
			GroupWait:           util.Pointer(model.Duration(time.Duration(5) * time.Minute)),
			GroupInterval:       util.Pointer(model.Duration(time.Duration(5) * time.Minute)),
			RepeatInterval:      util.Pointer(model.Duration(time.Duration(5) * time.Minute)),
		}},
	}
	_ = r.Validate()
	return r
}

var Empty = func() *definitions.Route {
	r := &definitions.Route{
		Receiver: "default-receiver",
	}
	_ = r.Validate()
	return r
}

var OverrideInherit = func() *definitions.Route {
	r := &definitions.Route{
		Receiver:       "provisioned-contact-point",
		GroupByStr:     []string{"alertname"},
		GroupWait:      util.Pointer(model.Duration(time.Duration(1) * time.Second)),
		GroupInterval:  util.Pointer(model.Duration(time.Duration(1) * time.Minute)),
		RepeatInterval: util.Pointer(model.Duration(time.Duration(1) * time.Hour)),
		Routes: []*definitions.Route{
			{
				Receiver:            "lotsa-emails",
				GroupByStr:          []string{"alertname", "grafana_folder"},
				GroupWait:           util.Pointer(model.Duration(time.Duration(10) * time.Second)),
				GroupInterval:       util.Pointer(model.Duration(time.Duration(10) * time.Minute)),
				RepeatInterval:      util.Pointer(model.Duration(time.Duration(10) * time.Hour)),
				Continue:            true,
				ActiveTimeIntervals: []string{"Some interval"},
				MuteTimeIntervals:   []string{"A provisioned interval"},
				ObjectMatchers: definitions.ObjectMatchers{
					{
						Name:  "severity",
						Type:  labels.MatchEqual,
						Value: "critical",
					},
				},
				Routes: []*definitions.Route{ // Override again.
					{
						Receiver:            "lotsa-emails-override",
						GroupByStr:          []string{"alertname", "grafana_folder", "one_more_group"},
						GroupWait:           util.Pointer(model.Duration(time.Duration(100) * time.Second)),
						GroupInterval:       util.Pointer(model.Duration(time.Duration(100) * time.Minute)),
						RepeatInterval:      util.Pointer(model.Duration(time.Duration(100) * time.Hour)),
						Continue:            false,
						ActiveTimeIntervals: []string{"Some interval override"},
						MuteTimeIntervals:   []string{"A provisioned interval override"},
						ObjectMatchers: definitions.ObjectMatchers{
							{
								Name:  "severity",
								Type:  labels.MatchNotEqual,
								Value: "critical",
							},
						},
					},
				},
			},
			{ // Inherit.
				ObjectMatchers: definitions.ObjectMatchers{
					{
						Name:  "severity",
						Type:  labels.MatchEqual,
						Value: "warn",
					},
				},
				Routes: []*definitions.Route{ // Inherit again.
					{
						ObjectMatchers: definitions.ObjectMatchers{
							{
								Name:  "severity",
								Type:  labels.MatchEqual,
								Value: "warn",
							},
						},
					},
				},
			},
		},
	}
	_ = r.Validate()
	return r
}

var MatcherVariety = func() *definitions.Route {
	r := &definitions.Route{
		Receiver:       "lotsa-emails",
		GroupByStr:     []string{"alertname"},
		GroupWait:      util.Pointer(model.Duration(time.Duration(2) * time.Second)),
		GroupInterval:  util.Pointer(model.Duration(time.Duration(2) * time.Minute)),
		RepeatInterval: util.Pointer(model.Duration(time.Duration(2) * time.Hour)),
		Routes: []*definitions.Route{
			{
				ObjectMatchers: definitions.ObjectMatchers{
					{Name: "severity", Type: labels.MatchEqual, Value: "warn"},
				},
			},
			{
				ObjectMatchers: definitions.ObjectMatchers{
					{Name: "severity", Type: labels.MatchRegexp, Value: "critical"},
				},
			},
			{
				ObjectMatchers: definitions.ObjectMatchers{
					{Name: "severity", Type: labels.MatchNotRegexp, Value: "info"},
				},
			},
			{
				ObjectMatchers: definitions.ObjectMatchers{
					{Name: "severity", Type: labels.MatchNotEqual, Value: "debug"},
				},
			},
		},
	}
	_ = r.Validate()
	return r
}

var SpecialCases = func() *definitions.Route {
	r := &definitions.Route{
		Receiver:   "default-receiver",
		GroupByStr: []string{"..."}, // No Grouping.
		Routes: []*definitions.Route{
			{
				ObjectMatchers: definitions.ObjectMatchers{
					{Name: "utf8", Type: labels.MatchEqual, Value: "🤖🔥✨👩🏽‍💻🚀🧪🧠😂💥🫠🇨🇦"},
				},
			},
			{
				ObjectMatchers: nil, // Empty matchers.
			},
			{
				ObjectMatchers: definitions.ObjectMatchers{
					// Regex edge cases: Unicode class, anchors, and an anchored capture.
					{Name: "path", Type: labels.MatchRegexp, Value: `^/api/v[0-9]+/\p{L}[\p{L}\p{N}_\-]*$`},
					// Values containing regex metacharacters.
					{Name: "special_regex_chars", Type: labels.MatchEqual, Value: `.*+?^()|[]\`},
				},
			},
		},
	}
	_ = r.Validate()
	return r
}

var DeeplyNested = func() *definitions.Route {
	r := &definitions.Route{
		Receiver:       "slack-multi-channel",
		GroupByStr:     []string{"alertname"},
		GroupWait:      util.Pointer(model.Duration(time.Duration(3) * time.Second)),
		GroupInterval:  util.Pointer(model.Duration(time.Duration(3) * time.Minute)),
		RepeatInterval: util.Pointer(model.Duration(time.Duration(3) * time.Hour)),
		Routes: []*definitions.Route{
			{
				ObjectMatchers: definitions.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "one"}},
				Routes: []*definitions.Route{
					{
						ObjectMatchers: definitions.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "two"}},
						Routes: []*definitions.Route{
							{
								ObjectMatchers: definitions.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "three"}},
								Routes: []*definitions.Route{
									{
										ObjectMatchers: definitions.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "four"}},
										Routes: []*definitions.Route{
											{
												ObjectMatchers: definitions.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "five"}},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	_ = r.Validate()
	return r
}
