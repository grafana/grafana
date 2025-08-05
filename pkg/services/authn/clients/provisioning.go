package clients

import (
	"context"
	"fmt"
	"regexp"
	"time"

	claims "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/authn"
)

var (
	_ authn.ContextAwareClient = (*Provisioning)(nil)
	_ fmt.Stringer             = (*Provisioning)(nil) // for debugging
)

type Provisioning struct {
	webhookRegexp *regexp.Regexp
}

func ProvideProvisioning() *Provisioning {
	// It's fine to compile a regexp here. The function is only called once per instance of APIBuilder, of which there should only ever be 1.
	// Assumption: APIVERSION has no leading or trailing slashes.
	webhookRegexp := regexp.MustCompile("^/apis/" + regexp.QuoteMeta(provisioning.APIVERSION) + "/namespaces/[^/]+/repositories/[^/]+/(webhook|render/.*)$")
	return &Provisioning{webhookRegexp}
}

func (p *Provisioning) String() string {
	return p.Name()
}

func (*Provisioning) Name() string {
	return authn.ClientProvisioning
}

func (p *Provisioning) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	return &authn.Identity{
		Type:            claims.TypeAnonymous,
		Name:            p.Name(),
		UID:             p.Name(),
		Login:           p.Name(),
		AuthID:          p.Name(),
		OrgID:           r.OrgID,
		AuthenticatedBy: authn.ClientProvisioning,
		LastSeenAt:      time.Now(),
	}, nil
}

func (*Provisioning) IsEnabled() bool {
	return true
}

func (p *Provisioning) Test(ctx context.Context, r *authn.Request) bool {
	path := r.HTTPRequest.URL.Path
	return p.webhookRegexp.MatchString(path)
}

func (*Provisioning) Priority() uint {
	return 5 // let most other clients go first
}
