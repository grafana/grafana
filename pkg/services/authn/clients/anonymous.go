package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

var _ authn.Client = new(Anonymous)

func ProvideAnonymous(cfg *setting.Cfg, orgService org.Service) *Anonymous {
	return &Anonymous{
		cfg:        cfg,
		log:        log.New("authn.anonymous"),
		orgService: orgService,
	}
}

type Anonymous struct {
	cfg        *setting.Cfg
	log        log.Logger
	orgService org.Service
}

func (a *Anonymous) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	o, err := a.orgService.GetByName(ctx, &org.GetOrgByNameQuery{Name: a.cfg.AnonymousOrgName})
	if err != nil {
		a.log.FromContext(ctx).Error("failed to find organization", "name", a.cfg.AnonymousOrgName, "error", err)
		return nil, err
	}

	return &authn.Identity{
		OrgID:       o.ID,
		OrgName:     o.Name,
		OrgRoles:    map[int64]org.RoleType{o.ID: org.RoleType(a.cfg.AnonymousOrgRole)},
		IsAnonymous: true,
	}, nil
}

func (a *Anonymous) Test(ctx context.Context, r *authn.Request) bool {
	// If anonymous client is register it can always be used for authentication
	return true
}
