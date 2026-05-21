package display

import (
	"strconv"
	"strings"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
)

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
