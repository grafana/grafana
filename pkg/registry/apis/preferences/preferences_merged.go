package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"dario.cat/mergo"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	return &merger{
		defaults: preferences.PreferencesSpec{
			Theme:     &cfg.DefaultTheme,
			Timezone:  &cfg.DateFormats.DefaultTimezone,
			WeekStart: &cfg.DateFormats.DefaultWeekStart,
			Language:  &cfg.DefaultLanguage,
		},
	}
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
	user, err := identity.GetRequester(ctx)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	ns := user.GetNamespace() // namespace not in context!

	if s.lister == nil {
		errhttp.Write(ctx, fmt.Errorf("lister is not configured"), w)
		return
	}

	list, err := s.lister.ListPreferences(ctx, nil)
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
	if len(items) == 0 {
		return &preferences.Preferences{
			TypeMeta:   preferences.PreferencesResourceInfo.TypeMeta(),
			ObjectMeta: v1.ObjectMeta{},
			Spec:       defaults,
		}, nil
	}

	// Mark the results with the most recent change date
	ts := items[0].CreationTimestamp
	updateTimestamp := func(v *preferences.Preferences) {
		updated, ok := v.Annotations[utils.AnnoKeyUpdatedTimestamp]
		if ok {
			t, err := time.Parse(time.RFC3339, updated)
			if err == nil && t.After(ts.Time) {
				ts = v1.NewTime(t)
				return // no need to check the creation timestamp
			}
		}
		if ts.Before(&v.CreationTimestamp) {
			ts = v.CreationTimestamp
		}
	}
	updateTimestamp(&items[0])

	p := &preferences.Preferences{
		TypeMeta:   preferences.PreferencesResourceInfo.TypeMeta(),
		ObjectMeta: v1.ObjectMeta{},
		Spec:       items[0].Spec,
	}

	for i := 1; i < len(items); i++ {
		updateTimestamp(&items[i])

		if err := mergo.Merge(&p.Spec, &items[i].Spec); err != nil {
			return nil, err
		}
	}

	// And finally apply the defaults if nothing else was configured
	if err := mergo.Merge(&p.Spec, &defaults); err != nil {
		return nil, err
	}

	// Add an RV to know if anything changed
	if !ts.IsZero() {
		p.CreationTimestamp = ts
		p.ResourceVersion = fmt.Sprintf("%d", ts.UnixMilli())
	}

	return p, nil
}
