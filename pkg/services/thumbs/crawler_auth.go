package thumbs

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type CrawlerAuthSetupService interface {
	Setup(ctx context.Context) (CrawlerAuth, error)
}

func ProvideCrawlerAuthSetupService() *OSSCrawlerAuthSetupService {
	return &OSSCrawlerAuthSetupService{}
}

type OSSCrawlerAuthSetupService struct{}

type CrawlerAuth interface {
	GetUserId(orgId int64) int64
	GetOrgRole() models.RoleType
}

type staticCrawlerAuth struct {
	userId  int64
	orgRole models.RoleType
}

func (o *staticCrawlerAuth) GetOrgRole() models.RoleType {
	return o.orgRole
}

func (o *staticCrawlerAuth) GetUserId(orgId int64) int64 {
	return o.userId
}

func (o *OSSCrawlerAuthSetupService) Setup(ctx context.Context) (CrawlerAuth, error) {
	return &staticCrawlerAuth{userId: 0, orgRole: models.ROLE_ADMIN}, nil
}
