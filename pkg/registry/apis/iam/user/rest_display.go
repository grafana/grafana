package user

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type LegacyDisplayREST struct {
	store legacy.LegacyIdentityStore
}

func NewLegacyDisplayREST(store legacy.LegacyIdentityStore) *LegacyDisplayREST {
	return &LegacyDisplayREST{store}
}

func (r *LegacyDisplayREST) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "display",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getDisplayMapping", // This is used by RTK client generator
							Tags:        []string{"Display"},
							Description: "Show user display information",
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
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "key",
										In:          "query",
										Description: "Display keys",
										Required:    true,
										Example:     "user:u000000001",
										Schema:      spec.ArrayProperty(spec.StringProperty()),
										//	Style:       "form",
										Explode: true,
									},
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
															Schema: &spec.Schema{
																SchemaProps: spec.SchemaProps{
																	Ref: spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apis.iam.v0alpha1.DisplayList"),
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
					},
				},
				Handler: r.handleDisplay,
			},
		},
	}
}

// This will always have an empty app url
var fakeCfgForGravatar = setting.ProvideService(&setting.Cfg{})

func (r *LegacyDisplayREST) handleDisplay(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("missing auth info"), w)
		return
	}

	ns, err := authlib.ParseNamespace(user.GetNamespace())
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	keys := parseKeys(req.URL.Query()["key"])
	users, err := r.store.ListDisplay(ctx, ns, legacy.ListDisplayQuery{
		OrgID: ns.OrgID,
		UIDs:  keys.uids,
		IDs:   keys.ids,
	})
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	rsp := &iam.DisplayList{
		Keys:        keys.keys,
		InvalidKeys: keys.invalid,
		Items:       make([]iam.Display, 0, len(users.Users)+len(keys.disp)+1),
	}
	for _, user := range users.Users {
		disp := iam.Display{
			Identity: iam.IdentityRef{
				Type: authlib.TypeUser,
				Name: user.UID,
			},
			DisplayName: user.NameOrFallback(),
			InternalID:  user.ID, // nolint:staticcheck
		}
		if user.IsServiceAccount {
			disp.Identity.Type = authlib.TypeServiceAccount
		}
		disp.AvatarURL = dtos.GetGravatarUrlWithDefault(fakeCfgForGravatar, user.Email, disp.DisplayName)
		rsp.Items = append(rsp.Items, disp)
	}

	// Append the constants here
	if len(keys.disp) > 0 {
		rsp.Items = append(rsp.Items, keys.disp...)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rsp)
}

type dispKeys struct {
	keys    []string
	uids    []string
	ids     []int64
	invalid []string

	// For terminal keys, this is a constant
	disp []iam.Display
}

func parseKeys(req []string) dispKeys {
	keys := dispKeys{
		uids: make([]string, 0, len(req)),
		ids:  make([]int64, 0, len(req)),
		keys: req,
	}
	for _, key := range req {
		idx := strings.Index(key, ":")
		if idx > 0 {
			t, err := authlib.ParseType(key[0:idx])
			if err != nil {
				keys.invalid = append(keys.invalid, key)
				continue
			}
			key = key[idx+1:]

			switch t {
			case authlib.TypeAnonymous:
				keys.disp = append(keys.disp, iam.Display{
					Identity: iam.IdentityRef{
						Type: t,
					},
					DisplayName: "Anonymous",
					AvatarURL:   dtos.GetGravatarUrl(fakeCfgForGravatar, string(t)),
				})
				continue
			case authlib.TypeAPIKey:
				keys.disp = append(keys.disp, iam.Display{
					Identity: iam.IdentityRef{
						Type: t,
						Name: key,
					},
					DisplayName: "API Key",
					AvatarURL:   dtos.GetGravatarUrl(fakeCfgForGravatar, string(t)),
				})
				continue
			case authlib.TypeProvisioning:
				keys.disp = append(keys.disp, iam.Display{
					Identity: iam.IdentityRef{
						Type: t,
					},
					DisplayName: "Provisioning",
					AvatarURL:   dtos.GetGravatarUrl(fakeCfgForGravatar, string(t)),
				})
				continue
			default:
				// OK
			}
		}

		// Try reading the internal ID
		id, err := strconv.ParseInt(key, 10, 64)
		if err == nil {
			if id == 0 {
				keys.disp = append(keys.disp, iam.Display{
					Identity: iam.IdentityRef{
						Type: authlib.TypeUser,
						Name: key,
					},
					DisplayName: "System admin",
				})
				continue
			}
			keys.ids = append(keys.ids, id)
		} else {
			keys.uids = append(keys.uids, key)
		}
	}
	return keys
}
