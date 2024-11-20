package auth

import (
	"errors"
	"fmt"
	"log/slog"
	"sync"

	"golang.org/x/net/context"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type BackgroundIdentityService interface {
	WorkerIdentity(ctx context.Context, namespace string) (identity.Requester, error)
}

func ProvideProvisioningIdentityService(
	serviceAccounts serviceaccounts.Service,
	authn authn.Service,
) BackgroundIdentityService {
	prefix := "provisioning-background-worker"
	return &backgroundIdentities{
		serviceAccountNamePrefix: prefix,
		role:                     org.RoleAdmin,

		log:             slog.Default().With("logger", "background-identities", "prefix", prefix),
		accounts:        make(map[int64]string),
		serviceAccounts: serviceAccounts,
		authn:           authn,
	}
}

type backgroundIdentities struct {
	log *slog.Logger

	serviceAccountNamePrefix string
	role                     org.RoleType

	// typed ids
	accounts map[int64]string
	mutex    sync.Mutex

	serviceAccounts serviceaccounts.Service
	authn           authn.Service
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
		orgId := info.OrgID
		serviceAccountName := fmt.Sprintf("%s-org-%d", o.serviceAccountNamePrefix, orgId)
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
					o.log.Error("Failed to retrieve service account", "err", err, "accountName", serviceAccountName)
					return nil, err
				}
				// update org_role to make sure everything works properly if someone has changed the role since SA's original creation
				dto, err := o.serviceAccounts.UpdateServiceAccount(ctx, orgId, accountId, &serviceaccounts.UpdateServiceAccountForm{
					Name: &serviceAccountName,
					Role: &o.role,
				})
				if err != nil {
					o.log.Error("Failed to update service account", "err", err, "accountName", serviceAccountName)
					return nil, err
				}

				serviceAccount = &serviceaccounts.ServiceAccountDTO{
					Id:  dto.Id,
					UID: dto.UID,
				}
			}
		}
		if serviceAccount == nil {
			o.log.Error("Failed to retrieve service account", "err", err, "accountName", serviceAccountName)
			return nil, err
		}

		id = claims.NewTypeID(claims.TypeServiceAccount, fmt.Sprintf("%d", serviceAccount.Id))
		o.accounts[info.OrgID] = id
	}

	return o.authn.ResolveIdentity(ctx, info.OrgID, id)
}
