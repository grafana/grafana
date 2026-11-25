package app

import (
	"fmt"
	"strings"
	"time"

	"dario.cat/mergo"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Merge combines preferences into one. items are in descending order of
// importance: for each field, the first value set wins, and the configured
// defaults fill anything still empty.
func (c *Config) Merge(items []v1.Preferences) (*v1.Preferences, error) {
	defaults := c.Defaults
	p := &v1.Preferences{
		TypeMeta: v1.PreferencesResourceInfo.TypeMeta(),
	}

	sources := make([]string, 0, len(items))
	var latest time.Time
	for _, item := range items {
		if err := mergo.Merge(&p.Spec, item.Spec); err != nil {
			return nil, err
		}
		if t := itemUpdatedAt(&item); t.After(latest) {
			latest = t
		}
		sources = append(sources, item.Name)
	}

	// Resolved here so the configured defaults fill the slot below.
	if p.Spec.HomeDashboardUID != nil && *p.Spec.HomeDashboardUID == v1.GlobalHomeDashboardUID {
		p.Spec.HomeDashboardUID = nil
	}

	// Home precedence, highest first (matches legacy GetHomeDashboard):
	//  1. HomeDashboardUID from preferences (user > team > org)
	//  2. home_page from settings
	//  3. custom home dashboard JSON from settings
	preferenceHome := p.Spec.HomeDashboardUID != nil && *p.Spec.HomeDashboardUID != ""
	homePage := defaults.HomeURL != nil && *defaults.HomeURL != ""
	configHome := defaults.HomeDashboardUID != nil && *defaults.HomeDashboardUID == c.homeDashboardName()
	switch {
	case preferenceHome:
		defaults.HomeURL = nil
	case configHome && homePage:
		defaults.HomeDashboardUID = nil
	}

	if err := mergo.Merge(&p.Spec, defaults); err != nil {
		return nil, err
	}

	// Where did the preferences come from
	p.Annotations = map[string]string{
		v1.APIGroup + "/source": strings.Join(sources, ","),
	}

	// An RV derived from the latest input lets clients tell when anything changed.
	if !latest.IsZero() {
		p.CreationTimestamp = metav1.NewTime(latest)
		p.ResourceVersion = fmt.Sprintf("%d", latest.UnixMilli())
	}
	return p, nil
}

// itemUpdatedAt returns the most recent of the item's creation timestamp and
// its updated timestamp annotation (when present and parseable).
func itemUpdatedAt(item *v1.Preferences) time.Time {
	t := item.CreationTimestamp.Time
	if updated, ok := item.Annotations[utils.AnnoKeyUpdatedTimestamp]; ok {
		if u, err := time.Parse(time.RFC3339, updated); err == nil && u.After(t) {
			t = u
		}
	}
	return t
}
