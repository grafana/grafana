package user

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

type LegacyDisplayREST struct {
	store legacy.LegacyIdentityStore
}

var (
	_ rest.Storage              = (*LegacyDisplayREST)(nil)
	_ rest.SingularNameProvider = (*LegacyDisplayREST)(nil)
	_ rest.Connecter            = (*LegacyDisplayREST)(nil)
	_ rest.Scoper               = (*LegacyDisplayREST)(nil)
	_ rest.StorageMetadata      = (*LegacyDisplayREST)(nil)
)

func NewLegacyDisplayREST(store legacy.LegacyIdentityStore) *LegacyDisplayREST {
	return &LegacyDisplayREST{store}
}

func (r *LegacyDisplayREST) New() runtime.Object {
	return &iamv0.DisplayList{}
}

func (r *LegacyDisplayREST) Destroy() {}

func (r *LegacyDisplayREST) NamespaceScoped() bool {
	return true
}

func (r *LegacyDisplayREST) GetSingularName() string {
	return "display"
}

func (r *LegacyDisplayREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (r *LegacyDisplayREST) ProducesObject(verb string) any {
	return &iamv0.DisplayList{}
}

func (r *LegacyDisplayREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (r *LegacyDisplayREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

// This will always have an empty app url
var fakeCfgForGravatar = &setting.Cfg{}

func (r *LegacyDisplayREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	// See: /pkg/services/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		return nil, errorsK8s.NewNotFound(schema.GroupResource{}, name)
	}
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		keys := parseKeys(req.URL.Query()["key"])
		users, err := r.store.ListDisplay(ctx, ns, legacy.ListDisplayQuery{
			OrgID: ns.OrgID,
			UIDs:  keys.uids,
			IDs:   keys.ids,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		rsp := &iamv0.DisplayList{
			Keys:        keys.keys,
			InvalidKeys: keys.invalid,
			Items:       make([]iamv0.Display, 0, len(users.Users)+len(keys.disp)+1),
		}
		for _, user := range users.Users {
			disp := iamv0.Display{
				Identity: iamv0.IdentityRef{
					Type: claims.TypeUser,
					Name: user.UID,
				},
				DisplayName: user.NameOrFallback(),
				InternalID:  user.ID,
			}
			if user.IsServiceAccount {
				disp.Identity.Type = claims.TypeServiceAccount
			}
			disp.AvatarURL = dtos.GetGravatarUrlWithDefault(fakeCfgForGravatar, user.Email, disp.DisplayName)
			rsp.Items = append(rsp.Items, disp)
		}

		// Append the constants here
		if len(keys.disp) > 0 {
			rsp.Items = append(rsp.Items, keys.disp...)
		}
		responder.Object(200, rsp)
	}), nil
}

type dispKeys struct {
	keys    []string
	uids    []string
	ids     []int64
	invalid []string

	// For terminal keys, this is a constant
	disp []iamv0.Display
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
			t, err := claims.ParseType(key[0:idx])
			if err != nil {
				keys.invalid = append(keys.invalid, key)
				continue
			}
			key = key[idx+1:]

			switch t {
			case claims.TypeAnonymous:
				keys.disp = append(keys.disp, iamv0.Display{
					Identity: iamv0.IdentityRef{
						Type: t,
					},
					DisplayName: "Anonymous",
					AvatarURL:   dtos.GetGravatarUrl(fakeCfgForGravatar, string(t)),
				})
				continue
			case claims.TypeAPIKey:
				keys.disp = append(keys.disp, iamv0.Display{
					Identity: iamv0.IdentityRef{
						Type: t,
						Name: key,
					},
					DisplayName: "API Key",
					AvatarURL:   dtos.GetGravatarUrl(fakeCfgForGravatar, string(t)),
				})
				continue
			case claims.TypeProvisioning:
				keys.disp = append(keys.disp, iamv0.Display{
					Identity: iamv0.IdentityRef{
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
				keys.disp = append(keys.disp, iamv0.Display{
					Identity: iamv0.IdentityRef{
						Type: claims.TypeUser,
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
