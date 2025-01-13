package auth

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/net/context"
	"k8s.io/client-go/rest"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/user"
)

type BackgroundIdentityService interface {
	WorkerIdentity(ctx context.Context, namespace string) (identity.Requester, error)

	// This will return a rest.Config with a worker identity attached in the context
	RestConfigForNamespace(ctx context.Context, namespace string) (*rest.Config, error)
}

func ProvideProvisioningIdentityService(
	serviceAccounts serviceaccounts.Service,
	authn authn.Service,
	clientConfigProvider apiserver.DirectRestConfigProvider,
	// HACK, for now we will use a global grafana admin user
	// service accounts need permissions granted (as far as i can tell)
	users user.Service,
	orgs org.Service,
) BackgroundIdentityService {
	prefix := "provisioning-background-worker"

	return &backgroundIdentities{
		serviceAccountNamePrefix: prefix,
		role:                     org.RoleAdmin,
		clientConfigProvider:     clientConfigProvider,

		accounts:        make(map[int64]string),
		serviceAccounts: serviceAccounts,
		authn:           authn,
		users:           users,
		orgs:            orgs,
	}
}

type backgroundIdentities struct {
	serviceAccountNamePrefix string
	role                     org.RoleType
	clientConfigProvider     apiserver.DirectRestConfigProvider

	// typed ids
	accounts map[int64]string
	mutex    sync.Mutex

	users           user.Service
	serviceAccounts serviceaccounts.Service
	authn           authn.Service
	orgs            org.Service
}

func (o *backgroundIdentities) WorkerIdentity(ctx context.Context, namespace string) (identity.Requester, error) {
	info, err := claims.ParseNamespace(namespace)
	if err != nil {
		return nil, err
	}

	o.mutex.Lock()
	defer o.mutex.Unlock()

	id, ok := o.accounts[info.OrgID]
	if !ok {
		// HACK -- find an admin user
		res, err := o.users.Search(context.Background(), &user.SearchUsersQuery{
			SignedInUser: &identity.StaticRequester{
				IsGrafanaAdmin: true,
				OrgID:          info.OrgID,
				Permissions: map[int64]map[string][]string{
					info.OrgID: {
						accesscontrol.ActionUsersRead: {"*"},
					},
				},
			},
			OrgID: info.OrgID,
		})
		if err != nil {
			return nil, err
		}

		found := false
		for _, v := range res.Users {
			if v.IsAdmin {
				id = fmt.Sprintf("user:%d", v.ID)
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("unable to find admin user")
		}

		// HACK -- (if false) and still allow lint
		switch o.serviceAccountNamePrefix {
		case "NOPE":
			id, err = o.makeAdminUser(ctx, info.OrgID)
		case "xxxx":
			id, err = o.verifyServiceAccount(ctx, info.OrgID)
		}

		if err != nil {
			return nil, err
		}

		o.accounts[info.OrgID] = id
	}

	return o.authn.ResolveIdentity(ctx, info.OrgID, id)
}

func (o *backgroundIdentities) makeAdminUser(ctx context.Context, orgId int64) (string, error) {
	found, err := o.users.GetByLogin(ctx, &user.GetUserByLoginQuery{
		LoginOrEmail: o.serviceAccountNamePrefix,
	})
	if found == nil {
		// Same user across all orgs??
		found, err = o.users.Create(ctx, &user.CreateUserCommand{
			Login:          o.serviceAccountNamePrefix,
			Name:           o.serviceAccountNamePrefix,
			Email:          o.serviceAccountNamePrefix,
			OrgID:          orgId,
			IsAdmin:        true,
			DefaultOrgRole: string(org.RoleAdmin),
		})
	}
	if err != nil {
		return "", err
	}

	// Make sure the user exists in the org
	err = o.orgs.UpdateOrgUser(ctx, &org.UpdateOrgUserCommand{
		Role:   identity.RoleAdmin,
		OrgID:  orgId,
		UserID: found.ID,
	})

	return claims.NewTypeID(claims.TypeUser, found.UID), err
}

func (o *backgroundIdentities) verifyServiceAccount(ctx context.Context, orgId int64) (string, error) {
	serviceAccountName := fmt.Sprintf("%s-org-%d", o.serviceAccountNamePrefix, orgId)
	logger := logging.FromContext(ctx).With("account_name", serviceAccountName)
	saForm := serviceaccounts.CreateServiceAccountForm{
		Name: serviceAccountName,
		Role: &o.role,
	}

	serviceAccount, err := o.serviceAccounts.CreateServiceAccount(ctx, orgId, &saForm)
	if serviceAccount == nil {
		accountAlreadyExists := errors.Is(err, serviceaccounts.ErrServiceAccountAlreadyExists)
		if accountAlreadyExists {
			accountId, err := o.serviceAccounts.RetrieveServiceAccountIdByName(ctx, orgId, serviceAccountName)
			if err != nil {
				logger.Error("Failed to retrieve service account", "err", err)
				return "", err
			}
			// update org_role to make sure everything works properly if someone has changed the role since SA's original creation
			dto, err := o.serviceAccounts.UpdateServiceAccount(ctx, orgId, accountId, &serviceaccounts.UpdateServiceAccountForm{
				Name: &serviceAccountName,
				Role: &o.role,
			})
			if err != nil {
				logger.Error("Failed to update service account", "err", err)
				return "", err
			}

			serviceAccount = &serviceaccounts.ServiceAccountDTO{
				Id:  dto.Id,
				UID: dto.UID,
			}
		}
	}
	if serviceAccount == nil {
		logger.Error("Failed to retrieve service account", "err", err)
		return "", err
	}

	return claims.NewTypeID(claims.TypeServiceAccount, fmt.Sprintf("%d", serviceAccount.Id)), nil
}

func (o *backgroundIdentities) RestConfigForNamespace(ctx context.Context, namespace string) (*rest.Config, error) {
	ts := time.Now()
	id, err := o.WorkerIdentity(ctx, namespace)
	if err != nil {
		return nil, err
	}
	return o.clientConfigProvider.GetRestConfigForBackgroundWorker(func() identity.Requester {
		if time.Since(ts) > time.Minute { // Get a fresh user every min
			ts = time.Now()
			id, _ = o.WorkerIdentity(ctx, namespace)
		}
		return id
	}), nil
}
