package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"dario.cat/mergo"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/home"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type PreferenceLister interface {
	ListPreferences(ctx context.Context, options *internalversion.ListOptions) (*preferences.PreferencesList, error)
}

type merger struct {
	defaults preferences.PreferencesSpec
	lister   PreferenceLister
}

func newMerger(cfg *setting.Cfg) *merger {
	m := &merger{
		defaults: preferences.PreferencesSpec{
			Theme:     &cfg.DefaultTheme,
			Timezone:  &cfg.DateFormats.DefaultTimezone,
			WeekStart: &cfg.DateFormats.DefaultWeekStart,
			Language:  &cfg.DefaultLanguage,
		},
	}
	if home.HasCustomHome(cfg) {
		m.defaults.HomeDashboardUID = new(home.DASHBOARD_NAME)
	}
	return m
}

func (s *merger) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	schema := defs[preferences.Preferences{}.OpenAPIModelName()].Schema

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "preferences/merged",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "mergedPreferences",
							Tags:        []string{"Preferences"},
							Description: "Get preferences for requester.  This combines the user preferences with the team and global defaults",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										In:          "path",
										Required:    true,
										Example:     "default",
										Description: "workspace",
										Schema:      spec.StringProperty(),
									},
									// TODO?? Allow getting theme+language from accept
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &schema,
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
				},
				Handler: s.Current,
			},
		},
	}
}

func (s *merger) Current(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	list, err := s.lister.ListPreferences(r.Context(), nil)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	p, err := merge(s.defaults, list.Items)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(p)
}

// items should be in descending order of importance — for each field, the
// first non-nil value wins; the configured defaults fill anything still empty.
func merge(defaults preferences.PreferencesSpec, items []preferences.Preferences) (*preferences.Preferences, error) {
	p := &preferences.Preferences{
		TypeMeta: preferences.PreferencesResourceInfo.TypeMeta(),
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
	if err := mergo.Merge(&p.Spec, defaults); err != nil {
		return nil, err
	}

	// Where did the preferences come from
	p.Annotations = map[string]string{
		preferences.APIGroup + "/source": strings.Join(sources, ","),
	}

	// An RV derived from the latest input lets clients tell when anything changed.
	if !latest.IsZero() {
		p.CreationTimestamp = v1.NewTime(latest)
		p.ResourceVersion = fmt.Sprintf("%d", latest.UnixMilli())
	}
	return p, nil
}

// itemUpdatedAt returns the most recent of the item's creation timestamp and
// its AnnoKeyUpdatedTimestamp annotation (when present and parseable).
func itemUpdatedAt(item *preferences.Preferences) time.Time {
	t := item.CreationTimestamp.Time
	if updated, ok := item.Annotations[utils.AnnoKeyUpdatedTimestamp]; ok {
		if u, err := time.Parse(time.RFC3339, updated); err == nil && u.After(t) {
			t = u
		}
	}
	return t
}
