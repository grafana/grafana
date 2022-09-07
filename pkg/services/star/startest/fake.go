package startest

import (
	"context"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/star"
)

type FakeStarStoreService struct {
	ExpectedStars     *star.Star
	ExpectedError     error
	ExpectedUserStars *star.GetUserStarsResult
}

func NewStarStoreServiceFake() *FakeStarStoreService {
	return &FakeStarStoreService{}
}

func (f *FakeStarStoreService) IsStarredByUser(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	return true, f.ExpectedError
}

func (f *FakeStarStoreService) Add(ctx context.Context, cmd *star.StarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarStoreService) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarStoreService) DeleteByUser(ctx context.Context, userID int64) error {
	return f.ExpectedError
}

func (f *FakeStarStoreService) GetByUser(ctx context.Context, query *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	return f.ExpectedUserStars, f.ExpectedError
}

type FakeStarHTTPService struct {
}

func NewStarHTTPServiceFake() *FakeStarHTTPService {
	return &FakeStarHTTPService{}
}

func (f *FakeStarHTTPService) GetStars(ctx *models.ReqContext) response.Response {
	return response.Success("ok")
}

func (f *FakeStarHTTPService) StarDashboard(ctx *models.ReqContext) response.Response {
	return response.Success("ok")
}

func (f *FakeStarHTTPService) UnstarDashboard(ctx *models.ReqContext) response.Response {
	return response.Success("ok")
}
