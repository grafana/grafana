package display

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/setting"
)

// Limited version of legacy.LegacyIdentityStore that has only one function
type LegacyIdentityStore interface {
	ListDisplay(ctx context.Context, ns authlib.NamespaceInfo, query legacy.ListDisplayQuery) (*legacy.ListUserResult, error)
}

type LegacyDisplayProvider struct {
	store LegacyIdentityStore
}

func NewLegacyDisplayProvider(store LegacyIdentityStore) *LegacyDisplayProvider {
	return &LegacyDisplayProvider{store}
}

// This will always have an empty app url
var fakeCfgForGravatar = &setting.Cfg{}

func (r *LegacyDisplayProvider) GetDisplayList(ctx context.Context, ns authlib.NamespaceInfo, key []string) (*iam.DisplayList, error) {
	keys := parseKeys(key)

	users, err := r.store.ListDisplay(ctx, ns, legacy.ListDisplayQuery{
		OrgID: ns.OrgID,
		UIDs:  keys.uids,
		IDs:   keys.ids,
	})
	if err != nil {
		return nil, err
	}

	rsp := &iam.DisplayList{
		Keys:        keys.keys,
		InvalidKeys: keys.invalid,
		Items:       make([]iam.Display, 0, len(users.Items)+len(keys.disp)+1),
	}
	for _, user := range users.Items {
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
	return rsp, nil
}
