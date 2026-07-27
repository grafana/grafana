package policy_exports

import (
	"embed"
	"time"

	prometheus "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"github.com/grafana/alerting/definition"

	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

//go:embed exports-*
var Responses embed.FS

func routeNameToFilename(routeName string, exportType string) string {
	return "exports-" + routeName + "." + exportType
}

func ReadExportResponse(routeName string, exportType string) ([]byte, error) {
	return Responses.ReadFile(routeNameToFilename(routeName, exportType))
}

var AllRoutes = func() map[string]*v1.Route {
	return map[string]*v1.Route{
		"empty":            Empty(),
		"override-inherit": OverrideInherit(),
		"matcher-variety":  MatcherVariety(),
		"special-cases":    SpecialCases(),
		"deeply-nested":    DeeplyNested(),
		"user-defined":     Legacy(),
	}
}

var Config = func() *v1.AMConfigV1 {
	return &v1.AMConfigV1{
		AlertmanagerConfig: v1.PostableApiAlertingConfig{
			Config: v1.Config{
				Route: Legacy(),
				// Add time interval references to help tests avoid validation errors.
				TimeIntervals: []v1.TimeInterval{
					{Name: "interval"},
					{Name: "active"},
					{Name: "Some interval"},
					{Name: "A provisioned interval"},
					{Name: "Some interval override"},
					{Name: "A provisioned interval override"},
				},
			},
			// Add receiver references to help tests avoid validation errors.
			Receivers: []*v1.PostableApiReceiver{
				{Receiver: definition.Receiver{Name: "default-receiver"}},
				{Receiver: definition.Receiver{Name: "lotsa-emails"}},
				{Receiver: definition.Receiver{Name: "lotsa-emails-override"}},
				{Receiver: definition.Receiver{Name: "slack-multi-channel"}},
				{Receiver: definition.Receiver{Name: "provisioned-contact-point"}},
				{Receiver: definition.Receiver{Name: "nested-receiver"}},
			},
		},
		ManagedRoutes: map[string]*v1.Route{
			"empty":            Empty(),
			"override-inherit": OverrideInherit(),
			"matcher-variety":  MatcherVariety(),
			"special-cases":    SpecialCases(),
			"deeply-nested":    DeeplyNested(),
		},
	}
}

var Legacy = func() *v1.Route {
	r := &v1.Route{
		Receiver:       "default-receiver",
		GroupByStr:     []string{"g1", "g2"},
		GroupWait:      new(model.Duration(time.Duration(30) * time.Second)),
		GroupInterval:  new(model.Duration(time.Duration(5) * time.Minute)),
		RepeatInterval: new(model.Duration(time.Duration(1) * time.Hour)),
		Routes: []*v1.Route{{
			Receiver:   "nested-receiver",
			GroupByStr: []string{"g3", "g4"},
			Matchers: prometheus.Matchers{
				{
					Name:  "a",
					Type:  labels.MatchEqual,
					Value: "b",
				},
			},
			ObjectMatchers:      v1.ObjectMatchers{{Type: 0, Name: "foo", Value: "bar"}},
			MuteTimeIntervals:   []string{"interval"},
			ActiveTimeIntervals: []string{"active"},
			Continue:            true,
			GroupWait:           new(model.Duration(time.Duration(5) * time.Minute)),
			GroupInterval:       new(model.Duration(time.Duration(5) * time.Minute)),
			RepeatInterval:      new(model.Duration(time.Duration(5) * time.Minute)),
		}},
	}
	_ = r.Validate()
	return r
}

var Empty = func() *v1.Route {
	r := &v1.Route{
		Receiver: "default-receiver",
	}
	_ = r.Validate()
	return r
}

var OverrideInherit = func() *v1.Route {
	r := &v1.Route{
		Receiver:       "provisioned-contact-point",
		GroupByStr:     []string{"alertname"},
		GroupWait:      new(model.Duration(time.Duration(1) * time.Second)),
		GroupInterval:  new(model.Duration(time.Duration(1) * time.Minute)),
		RepeatInterval: new(model.Duration(time.Duration(1) * time.Hour)),
		Routes: []*v1.Route{
			{
				Receiver:            "lotsa-emails",
				GroupByStr:          []string{"alertname", "grafana_folder"},
				GroupWait:           new(model.Duration(time.Duration(10) * time.Second)),
				GroupInterval:       new(model.Duration(time.Duration(10) * time.Minute)),
				RepeatInterval:      new(model.Duration(time.Duration(10) * time.Hour)),
				Continue:            true,
				ActiveTimeIntervals: []string{"Some interval"},
				MuteTimeIntervals:   []string{"A provisioned interval"},
				ObjectMatchers: v1.ObjectMatchers{
					{
						Name:  "severity",
						Type:  labels.MatchEqual,
						Value: "critical",
					},
				},
				Routes: []*v1.Route{ // Override again.
					{
						Receiver:            "lotsa-emails-override",
						GroupByStr:          []string{"alertname", "grafana_folder", "one_more_group"},
						GroupWait:           new(model.Duration(time.Duration(100) * time.Second)),
						GroupInterval:       new(model.Duration(time.Duration(100) * time.Minute)),
						RepeatInterval:      new(model.Duration(time.Duration(100) * time.Hour)),
						Continue:            false,
						ActiveTimeIntervals: []string{"Some interval override"},
						MuteTimeIntervals:   []string{"A provisioned interval override"},
						ObjectMatchers: v1.ObjectMatchers{
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
				ObjectMatchers: v1.ObjectMatchers{
					{
						Name:  "severity",
						Type:  labels.MatchEqual,
						Value: "warn",
					},
				},
				Routes: []*v1.Route{ // Inherit again.
					{
						ObjectMatchers: v1.ObjectMatchers{
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

var MatcherVariety = func() *v1.Route {
	r := &v1.Route{
		Receiver:       "lotsa-emails",
		GroupByStr:     []string{"alertname"},
		GroupWait:      new(model.Duration(time.Duration(2) * time.Second)),
		GroupInterval:  new(model.Duration(time.Duration(2) * time.Minute)),
		RepeatInterval: new(model.Duration(time.Duration(2) * time.Hour)),
		Routes: []*v1.Route{
			{
				ObjectMatchers: v1.ObjectMatchers{
					{Name: "severity", Type: labels.MatchEqual, Value: "warn"},
				},
			},
			{
				ObjectMatchers: v1.ObjectMatchers{
					{Name: "severity", Type: labels.MatchRegexp, Value: "critical"},
				},
			},
			{
				ObjectMatchers: v1.ObjectMatchers{
					{Name: "severity", Type: labels.MatchNotRegexp, Value: "info"},
				},
			},
			{
				ObjectMatchers: v1.ObjectMatchers{
					{Name: "severity", Type: labels.MatchNotEqual, Value: "debug"},
				},
			},
		},
	}
	_ = r.Validate()
	return r
}

var SpecialCases = func() *v1.Route {
	r := &v1.Route{
		Receiver:   "default-receiver",
		GroupByStr: []string{"..."}, // No Grouping.
		Routes: []*v1.Route{
			{
				ObjectMatchers: v1.ObjectMatchers{
					{Name: "utf8", Type: labels.MatchEqual, Value: "🤖🔥✨👩🏽‍💻🚀🧪🧠😂💥🫠🇨🇦"},
				},
			},
			{
				ObjectMatchers: nil, // Empty matchers.
			},
			{
				ObjectMatchers: v1.ObjectMatchers{
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

var DeeplyNested = func() *v1.Route {
	r := &v1.Route{
		Receiver:       "slack-multi-channel",
		GroupByStr:     []string{"alertname"},
		GroupWait:      new(model.Duration(time.Duration(3) * time.Second)),
		GroupInterval:  new(model.Duration(time.Duration(3) * time.Minute)),
		RepeatInterval: new(model.Duration(time.Duration(3) * time.Hour)),
		Routes: []*v1.Route{
			{
				ObjectMatchers: v1.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "one"}},
				Routes: []*v1.Route{
					{
						ObjectMatchers: v1.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "two"}},
						Routes: []*v1.Route{
							{
								ObjectMatchers: v1.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "three"}},
								Routes: []*v1.Route{
									{
										ObjectMatchers: v1.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "four"}},
										Routes: []*v1.Route{
											{
												ObjectMatchers: v1.ObjectMatchers{{Name: "level", Type: labels.MatchEqual, Value: "five"}},
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
