package clients

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"time"

	claims "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	_ authn.ContextAwareClient = (*Provisioning)(nil)
	_ fmt.Stringer             = (*Provisioning)(nil) // for debugging
)

type Provisioning struct {
	webhookRegexp *regexp.Regexp
	user          user.Service
}

func ProvideProvisioning(userSvc user.Service) *Provisioning {
	// it's fine to compile a regexp here. The function is only called once per instance of APIBuilder, of which there should only ever be 1.
	webhookRegexp := regexp.MustCompile("^/apis/" + regexp.QuoteMeta(provisioning.APIVERSION) + "/namespaces/[^/]+/repositories/[^/]+/webhook$")
	return &Provisioning{webhookRegexp, userSvc}
}

func (p *Provisioning) String() string {
	return p.Name()
}

func (*Provisioning) Name() string {
	return authn.ClientProvisioning
}

func (p *Provisioning) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	serviceAccount, err := p.user.GetByUID(ctx, &user.GetUserByUIDQuery{UID: p.Name()})
	if errors.Is(err, user.ErrUserNotFound) {
		// Create the account and use it.
		serviceAccount, err = p.user.CreateServiceAccount(ctx, &user.CreateUserCommand{
			UID:              p.Name(),
			Name:             p.Name(),
			Login:            p.Name(),
			IsServiceAccount: true,
			EmailVerified:    true,
			IsAdmin:          false, // we have no need for an admin account
		})
	}
	if err != nil {
		return nil, err
	}

	return &authn.Identity{
		Type:            claims.TypeServiceAccount,
		ID:              strconv.FormatInt(serviceAccount.ID, 10),
		UID:             serviceAccount.UID,
		OrgID:           serviceAccount.OrgID,
		Email:           serviceAccount.Email,
		Login:           serviceAccount.Login,
		IsGrafanaAdmin:  &serviceAccount.IsAdmin,
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
	return 50
}
