package preferences

import (
	"encoding/json"
	"net/http"

	"dario.cat/mergo"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type calculator struct {
	defaults preferences.PreferencesSpec
	sql      *legacy.LegacySQL
}

func newCalculator(cfg *setting.Cfg, sql *legacy.LegacySQL) *calculator {
	return &calculator{
		sql: sql,
		defaults: preferences.PreferencesSpec{
			Theme:     &cfg.DefaultTheme,
			Timezone:  &cfg.DateFormats.DefaultTimezone,
			WeekStart: &cfg.DateFormats.DefaultWeekStart,
			Language:  &cfg.DefaultLanguage,
		},
	}
}

func (s *calculator) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	schema := defs["github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1.Preference"].Schema

	//	om.github.grafana.grafana.apps.preferences.pkg.apis.preferences.v0alpha1.Preference
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "current", // calculate?
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "currentPreferences",
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
									// Allow getting theme+language from accept
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

func (s *calculator) Current(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, err := identity.GetRequester(ctx)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	ns := request.NamespaceValue(ctx)
	p := preferences.Preferences{
		TypeMeta: preferences.PreferencesResourceInfo.TypeMeta(),
		ObjectMeta: v1.ObjectMeta{
			CreationTimestamp: v1.Now(),
			Namespace:         ns,
		},
		Spec: s.defaults,
	}

	list, err := s.sql.ListPreferences(ctx, ns, user, false)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	// Iterate in reverse order (least relevant to most relevant)
	for i := len(list.Items) - 1; i >= 0; i-- {
		v := list.Items[i]
		if err := mergo.Merge(&p.Spec, &v.Spec); err != nil {
			errhttp.Write(ctx, err, w)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(p)
}
