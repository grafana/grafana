package thumbs

import (
	"context"
)

type CrawlerAccountSetupService interface {
	Setup(ctx context.Context) (CrawlerAccountIds, error)
}

func ProvideCrawlerAccountSetupService() *OSSCrawlerAccountSetupService {
	return &OSSCrawlerAccountSetupService{}
}

type OSSCrawlerAccountSetupService struct{}

type CrawlerAccountIds interface {
	GetForOrgId(orgId int64) int64
}

type staticCrawlerAccountIds struct {
	userId int64
}

func (o *staticCrawlerAccountIds) GetForOrgId(orgId int64) int64 {
	return o.userId
}

func (o *OSSCrawlerAccountSetupService) Setup(ctx context.Context) (CrawlerAccountIds, error) {
	return &staticCrawlerAccountIds{userId: 0}, nil
}
