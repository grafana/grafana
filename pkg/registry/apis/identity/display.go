package identity

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/authlib/claims"
	identity "github.com/grafana/grafana/pkg/apimachinery/apis/identity/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

type displayREST struct {
	logger  log.Logger
	builder *IdentityAPIBuilder
}

var (
	_ rest.Storage              = (*displayREST)(nil)
	_ rest.SingularNameProvider = (*displayREST)(nil)
	_ rest.Connecter            = (*displayREST)(nil)
	_ rest.Scoper               = (*displayREST)(nil)
	_ rest.StorageMetadata      = (*displayREST)(nil)
)

func newDisplayREST(builder *IdentityAPIBuilder) *displayREST {
	return &displayREST{
		logger:  log.New("identity display"),
		builder: builder,
	}
}

func (r *displayREST) New() runtime.Object {
	return &identity.IdentityDisplayResults{}
}

func (r *displayREST) Destroy() {}

func (r *displayREST) NamespaceScoped() bool {
	return true
}

func (r *displayREST) GetSingularName() string {
	return "QueryResults" // Used for the
}

func (r *displayREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *displayREST) ProducesObject(verb string) interface{} {
	return &identity.IdentityDisplayResults{}
}

func (r *displayREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *displayREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *displayREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	// See: /pkg/services/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		return nil, errorsK8s.NewNotFound(schema.GroupResource{}, name)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ns, ok := request.NamespaceFrom(ctx)
		if !ok {
			responder.Error(fmt.Errorf("displayREST, expected namespace"))
			return
		}
		keys := parseKeys(req.URL.Query()["key"])

		v, err := r.builder.Store.GetDisplay(ctx, ns, &user.GetDisplayCommand{
			UIDs: keys.uids,
			IDs:  keys.ids,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		rsp := &identity.IdentityDisplayResults{
			Keys:        keys.keys,
			InvalidKeys: keys.invalid,
			Display:     v,
		}
		// Append the constants here
		if len(keys.disp) > 0 {
			rsp.Display = append(rsp.Display, keys.disp...)
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
	disp []identity.IdentityDisplay
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
				keys.disp = append(keys.disp, identity.IdentityDisplay{
					IdentityType: t,
					Display:      "Anonymous",
				})
				continue
			case claims.TypeAPIKey:
				keys.disp = append(keys.disp, identity.IdentityDisplay{
					IdentityType: t,
					UID:          key,
					Display:      "API Key",
				})
				continue
			case claims.TypeProvisioning:
				keys.disp = append(keys.disp, identity.IdentityDisplay{
					IdentityType: t,
					UID:          "Provisioning",
					Display:      "Provisioning",
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
				keys.disp = append(keys.disp, identity.IdentityDisplay{
					IdentityType: claims.TypeUser,
					UID:          key,
					Display:      "System admin",
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
