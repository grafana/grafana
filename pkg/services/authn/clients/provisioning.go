package clients

import (
	"context"
	regexp2 "regexp"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
)

type Provisioning struct {
}

func ProvideProvisioning() *Provisioning {
	return &Provisioning{}
}

func (c *Provisioning) Name() string {
	return authn.ClientProvisioning
}

func (c *Provisioning) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	return &authn.Identity{
		ID:              "1",
		Type:            claims.TypeProvisioning,
		OrgID:           0,
		OrgRoles:        map[int64]org.RoleType{0: "WebhookEventsWriter"},
		LastSeenAt:      time.Now(),
		AuthenticatedBy: login.ProvisioningModule,
	}, nil
}

func (c *Provisioning) IsEnabled() bool {
	return true
}

func (c *Provisioning) Test(ctx context.Context, r *authn.Request) bool {
	if r.HTTPRequest == nil {
		return false
	}

	re := regexp2.MustCompile(`/apis/provisioning.grafana.app/v.*/namespaces/.*/repositories/.*/webhook`)
	return re.Match([]byte(r.HTTPRequest.RequestURI))
}

func (c *Provisioning) Priority() uint {
	return 10
}
