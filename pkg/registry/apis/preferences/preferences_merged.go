package preferences

import (
	"encoding/json"
	"net/http"

	"dario.cat/mergo"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type merger struct {
	defaults preferences.PreferencesSpec
	sql      *legacy.LegacySQL
}

func newMerger(cfg *setting.Cfg, sql *legacy.LegacySQL) *merger {
	return &merger{
		sql: sql,
		defaults: preferences.PreferencesSpec{
			Theme:     &cfg.DefaultTheme,
			Timezone:  &cfg.DateFormats.DefaultTimezone,
			WeekStart: &cfg.DateFormats.DefaultWeekStart,
			Language:  &cfg.DefaultLanguage,
		},
	}
}

func (s *merger) Current(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, err := identity.GetRequester(ctx)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	ns := user.GetNamespace() // namespace not in context!
	list, err := s.sql.ListPreferences(ctx, ns, user, false)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	p, err := merge(s.defaults, list.Items)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	p.Namespace = ns

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(p)
}

// items should be in ascending order of importance
func merge(defaults preferences.PreferencesSpec, items []preferences.Preferences) (*preferences.Preferences, error) {
	p := &preferences.Preferences{
		TypeMeta:   preferences.PreferencesResourceInfo.TypeMeta(),
		ObjectMeta: v1.ObjectMeta{},
		Spec:       defaults,
	}

	// Iterate in reverse order (least relevant to most relevant)
	for _, v := range items {
		// Set the time from the most recent change
		if p.CreationTimestamp.IsZero() || v.CreationTimestamp.After(p.CreationTimestamp.Time) {
			p.CreationTimestamp = v.CreationTimestamp
		}

		if err := mergo.Merge(&p.Spec, &v.Spec, mergo.WithOverride); err != nil {
			return nil, err
		}
	}
	return p, nil
}
