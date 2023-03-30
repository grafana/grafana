package thumbs

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type CrawlerAuthSetupService interface {
	Setup(ctx context.Context) (CrawlerAuth, error)
}

func ProvideCrawlerAuthSetupService(serviceAccounts serviceaccounts.Service,
	sqlStore db.DB, orgService org.Service) *OSSCrawlerAuthSetupService {
	return &OSSCrawlerAuthSetupService{
		serviceAccountNamePrefix: "dashboard-previews-crawler-org-",
		serviceAccounts:          serviceAccounts,
		log:                      log.New("oss_crawler_account_setup_service"),
		sqlStore:                 sqlStore,
		orgService:               orgService,
	}
}

type OSSCrawlerAuthSetupService struct {
	log                      log.Logger
	serviceAccountNamePrefix string
	serviceAccounts          serviceaccounts.Service
	sqlStore                 db.DB
	orgService               org.Service
}

type CrawlerAuth interface {
	GetUserId(orgId int64) int64
	GetLogin(orgId int64) string
	GetOrgRole() org.RoleType
}

func (o *OSSCrawlerAuthSetupService) findAllOrgIds(ctx context.Context) ([]int64, error) {
	searchAllOrgsQuery := &org.SearchOrgsQuery{}
	result, err := o.orgService.Search(ctx, searchAllOrgsQuery)
	if err != nil {
		o.log.Error("Error when searching for orgs", "err", err)
		return nil, err
	}

	orgIds := make([]int64, 0)
	for i := range result {
		orgIds = append(orgIds, result[i].ID)
	}

	return orgIds, nil
}

type crawlerAuth struct {
	accountIdByOrgId map[int64]int64
	loginByOrgId     map[int64]string
	orgRole          org.RoleType
}

func (o *crawlerAuth) GetOrgRole() org.RoleType {
	return o.orgRole
}

func (o *crawlerAuth) GetUserId(orgId int64) int64 {
	return o.accountIdByOrgId[orgId]
}

func (o *crawlerAuth) GetLogin(orgId int64) string {
	return o.loginByOrgId[orgId]
}

func (o *OSSCrawlerAuthSetupService) Setup(ctx context.Context) (CrawlerAuth, error) {
	orgIds, err := o.findAllOrgIds(ctx)
	if err != nil {
		return nil, err
	}

	// userId:0 and RoleAdmin grants the crawler process permissions to view all dashboards in all folders & orgs
	// the process doesn't and shouldn't actually need to edit/modify any resources from the UI
	orgRole := org.RoleAdmin

	accountIdByOrgId := make(map[int64]int64)
	loginByOrgId := make(map[int64]string)
	for _, orgId := range orgIds {
		o.log.Info("Creating account for org", "orgId", orgId)

		serviceAccountNameOrg := o.serviceAccountNamePrefix + strconv.FormatInt(orgId, 10)

		saForm := serviceaccounts.CreateServiceAccountForm{
			Name: serviceAccountNameOrg,
			Role: &orgRole,
		}

		serviceAccount, err := o.serviceAccounts.CreateServiceAccount(ctx, orgId, &saForm)
		accountAlreadyExists := errors.Is(err, serviceaccounts.ErrServiceAccountAlreadyExists)

		if !accountAlreadyExists && err != nil {
			o.log.Error("Failed to create the service account", "err", err, "accountName", serviceAccountNameOrg, "orgId", orgId)
			return nil, err
		}

		var serviceAccountLogin string
		var serviceAccountId int64
		if accountAlreadyExists {
			id, err := o.serviceAccounts.RetrieveServiceAccountIdByName(ctx, orgId, serviceAccountNameOrg)
			if err != nil {
				o.log.Error("Failed to retrieve service account", "err", err, "accountName", serviceAccountNameOrg)
				return nil, err
			}

			// update org_role to make sure everything works properly if someone has changed the role since SA's original creation
			dto, err := o.serviceAccounts.UpdateServiceAccount(ctx, orgId, id, &serviceaccounts.UpdateServiceAccountForm{
				Name: &serviceAccountNameOrg,
				Role: &orgRole,
			})

			if err != nil {
				o.log.Error("Failed to update service account's role", "err", err, "accountName", serviceAccountNameOrg)
				return nil, err
			}

			serviceAccountLogin = dto.Login
			serviceAccountId = id
		} else {
			serviceAccountLogin = serviceAccount.Login
			serviceAccountId = serviceAccount.Id
		}

		accountIdByOrgId[orgId] = serviceAccountId
		loginByOrgId[orgId] = serviceAccountLogin
	}

	return &crawlerAuth{accountIdByOrgId: accountIdByOrgId, loginByOrgId: loginByOrgId, orgRole: orgRole}, nil
}
