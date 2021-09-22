package ualert

import (
	"encoding/json"
	"fmt"
	"sort"

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
}

type NewRoute struct {
	GroupByStr []string `yaml:"group_by,omitempty" json:"group_by,omitempty"`
	Receiver   string   `yaml:"receiver,omitempty" json:"receiver,omitempty"`
	// Keep Matchers in case of version downgrade.
	Matchers       Matchers       `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	ObjectMatchers ObjectMatchers `yaml:"object_matchers,omitempty" json:"object_matchers,omitempty"`
	Routes         []*NewRoute    `yaml:"routes,omitempty" json:"routes,omitempty"`
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
