package ualert

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/prometheus/alertmanager/pkg/labels"
	"xorm.io/xorm"
)

type migrateRoutes struct {
	migrator.MigrationBase
	mg *migrator.Migrator
}

func (m *migrateRoutes) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (m *migrateRoutes) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	configs := []AlertConfiguration{}
	err := sess.SQL(`SELECT * FROM alert_configuration`).Find(&configs)
	if err != nil {
		return err
	}

	for i, aCfg := range configs {
		var oldUserConfig OldPostableUserConfig
		err = json.Unmarshal([]byte(aCfg.AlertmanagerConfiguration), &oldUserConfig)
		if err != nil {
			return fmt.Errorf("unable to read old alertmanager configuration for orgId %v: %w", aCfg.OrgID, err)
		}

		newRoutePostableApiAlertingConfig := NewRoutePostableApiAlertingConfig{
			Templates: oldUserConfig.AlertmanagerConfig.Templates,
			Receivers: oldUserConfig.AlertmanagerConfig.Receivers,
			Route:     oldRouteToNewRoute(oldUserConfig.AlertmanagerConfig.Route),
		}

		newConfigUserConfig := NewRoutePostableUserConfig{
			TemplateFiles:      oldUserConfig.TemplateFiles,
			AlertmanagerConfig: newRoutePostableApiAlertingConfig,
		}

		b, err := json.Marshal(newConfigUserConfig)
		if err != nil {
			return err
		}

		configs[i].AlertmanagerConfiguration = string(b)
	}

	for _, cfg := range configs {
		_, err = sess.ID(cfg.ID).Update(&cfg)
		if err != nil {
			return err
		}
	}

	return nil
}

func oldRouteToNewRoute(topRoute *OldRoute) *NewRoute {
	if topRoute == nil {
		return nil
	}
	var makeNewRoute func(oR *OldRoute) *NewRoute
	makeNewRoute = func(oR *OldRoute) *NewRoute {
		newRoute := &NewRoute{
			Receiver:       oR.Receiver,
			GroupByStr:     oR.GroupByStr,
			Matchers:       oR.Matchers, // Kept for downgrades
			ObjectMatchers: ObjectMatchers(oR.Matchers),
			Routes:         make([]*NewRoute, 0, len(oR.Routes)),

			Continue:       oR.Continue,
			GroupWait:      oR.GroupWait,
			GroupInterval:  oR.GroupInterval,
			RepeatInterval: oR.RepeatInterval,
		}

		for _, rt := range oR.Routes {
			newRoute.Routes = append(newRoute.Routes, makeNewRoute(rt))
		}

		return newRoute
	}

	return makeNewRoute(topRoute)

}

// UnmarshalJSON implements the json.Unmarshaler interface for Matchers.
func (m *Matchers) UnmarshalJSON(data []byte) error {
	var lines []string
	if err := json.Unmarshal(data, &lines); err != nil {
		return err
	}
	for _, line := range lines {
		pm, err := labels.ParseMatchers(line)
		if err != nil {
			return err
		}
		*m = append(*m, pm...)
	}
	sort.Sort(labels.Matchers(*m))
	return nil
}

type OldRoute struct {
	Receiver   string      `yaml:"receiver,omitempty" json:"receiver,omitempty"`
	Matchers   Matchers    `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	Routes     []*OldRoute `yaml:"routes,omitempty" json:"routes,omitempty"`
	GroupByStr []string    `yaml:"group_by,omitempty" json:"group_by,omitempty"`
	Continue   bool        `yaml:"continue" json:"continue,omitempty"`

	GroupWait      Duration `yaml:"group_wait,omitempty" json:"group_wait,omitempty"`
	GroupInterval  Duration `yaml:"group_interval,omitempty" json:"group_interval,omitempty"`
	RepeatInterval Duration `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty"`
}

type NewRoute struct {
	Receiver string `yaml:"receiver,omitempty" json:"receiver,omitempty"`
	// Keep Matchers in case of version downgrade.
	Matchers       Matchers       `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	ObjectMatchers ObjectMatchers `yaml:"object_matchers,omitempty" json:"object_matchers,omitempty"`
	Routes         []*NewRoute    `yaml:"routes,omitempty" json:"routes,omitempty"`
	GroupByStr     []string       `yaml:"group_by,omitempty" json:"group_by,omitempty"`
	Continue       bool           `yaml:"continue" json:"continue,omitempty"`

	GroupWait      Duration `yaml:"group_wait,omitempty" json:"group_wait,omitempty"`
	GroupInterval  Duration `yaml:"group_interval,omitempty" json:"group_interval,omitempty"`
	RepeatInterval Duration `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty"`
}

func AddMigrateRoutes(mg *migrator.Migrator) {
	mg.AddMigration("alerting ng: add object_match to routes",
		&migrateRoutes{mg: mg})
}

type NewRoutePostableApiAlertingConfig struct {
	Route     *NewRoute              `yaml:"route,omitempty" json:"route,omitempty"`
	Templates []string               `yaml:"templates" json:"templates"`
	Receivers []*PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type OldPostableApiAlertingConfig struct {
	Route     *OldRoute              `yaml:"route,omitempty" json:"route,omitempty"`
	Templates []string               `yaml:"templates" json:"templates"`
	Receivers []*PostableApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type NewRoutePostableUserConfig struct {
	TemplateFiles      map[string]string                 `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig NewRoutePostableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
}

type OldPostableUserConfig struct {
	TemplateFiles      map[string]string            `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig OldPostableApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
}

// ObjectMatchers is Matchers with a different Unmarshal and Marshal methods that accept matchers as objects
// that have already been parsed.
type ObjectMatchers labels.Matchers

// UnmarshalJSON implements the json.Unmarshaler interface for Matchers.
func (m *ObjectMatchers) UnmarshalJSON(data []byte) error {
	var rawMatchers [][3]string
	if err := json.Unmarshal(data, &rawMatchers); err != nil {
		return err
	}
	for _, rawMatcher := range rawMatchers {
		var matchType labels.MatchType
		switch rawMatcher[1] {
		case "=":
			matchType = labels.MatchEqual
		case "!=":
			matchType = labels.MatchNotEqual
		case "=~":
			matchType = labels.MatchRegexp
		case "!~":
			matchType = labels.MatchNotRegexp
		default:
			return fmt.Errorf("unsupported match type %q in matcher", rawMatcher[1])
		}

		matcher, err := labels.NewMatcher(matchType, rawMatcher[0], rawMatcher[2])
		if err != nil {
			return err
		}
		*m = append(*m, matcher)
	}
	sort.Sort(labels.Matchers(*m))
	return nil
}

// MarshalJSON implements the json.Marshaler interface for Matchers.
func (m ObjectMatchers) MarshalJSON() ([]byte, error) {
	if len(m) == 0 {
		return nil, nil
	}
	result := make([][3]string, len(m))
	for i, matcher := range m {
		result[i] = [3]string{matcher.Name, matcher.Type.String(), matcher.Value}
	}
	return json.Marshal(result)
}

type Duration time.Duration

var durationRE = regexp.MustCompile("^(([0-9]+)y)?(([0-9]+)w)?(([0-9]+)d)?(([0-9]+)h)?(([0-9]+)m)?(([0-9]+)s)?(([0-9]+)ms)?$")

// ParseDuration parses a string into a time.Duration, assuming that a year
// always has 365d, a week always has 7d, and a day always has 24h.
func ParseDuration(durationStr string) (Duration, error) {
	switch durationStr {
	case "0":
		// Allow 0 without a unit.
		return 0, nil
	case "":
		return 0, fmt.Errorf("empty duration string")
	}
	matches := durationRE.FindStringSubmatch(durationStr)
	if matches == nil {
		return 0, fmt.Errorf("not a valid duration string: %q", durationStr)
	}
	var dur time.Duration

	// Parse the match at pos `pos` in the regex and use `mult` to turn that
	// into ms, then add that value to the total parsed duration.
	var overflowErr error
	m := func(pos int, mult time.Duration) {
		if matches[pos] == "" {
			return
		}
		n, _ := strconv.Atoi(matches[pos])

		// Check if the provided duration overflows time.Duration (> ~ 290years).
		if n > int((1<<63-1)/mult/time.Millisecond) {
			overflowErr = errors.New("duration out of range")
		}
		d := time.Duration(n) * time.Millisecond
		dur += d * mult

		if dur < 0 {
			overflowErr = errors.New("duration out of range")
		}
	}

	m(2, 1000*60*60*24*365) // y
	m(4, 1000*60*60*24*7)   // w
	m(6, 1000*60*60*24)     // d
	m(8, 1000*60*60)        // h
	m(10, 1000*60)          // m
	m(12, 1000)             // s
	m(14, 1)                // ms

	return Duration(dur), overflowErr
}

func (d Duration) String() string {
	var (
		ms = int64(time.Duration(d) / time.Millisecond)
		r  = ""
	)
	if ms == 0 {
		return "0s"
	}

	f := func(unit string, mult int64, exact bool) {
		if exact && ms%mult != 0 {
			return
		}
		if v := ms / mult; v > 0 {
			r += fmt.Sprintf("%d%s", v, unit)
			ms -= v * mult
		}
	}

	// Only format years and weeks if the remainder is zero, as it is often
	// easier to read 90d than 12w6d.
	f("y", 1000*60*60*24*365, true)
	f("w", 1000*60*60*24*7, true)

	f("d", 1000*60*60*24, false)
	f("h", 1000*60*60, false)
	f("m", 1000*60, false)
	f("s", 1000, false)
	f("ms", 1, false)

	return r
}

// MarshalJSON implements the json.Marshaler interface.
func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.String())
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (d *Duration) UnmarshalJSON(bytes []byte) error {
	var s string
	if err := json.Unmarshal(bytes, &s); err != nil {
		return err
	}
	dur, err := ParseDuration(s)
	if err != nil {
		return err
	}
	*d = dur
	return nil
}
