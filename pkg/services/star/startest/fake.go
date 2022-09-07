package startest

import (
	"context"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/star"
)

type FakeStarService struct {
	ExpectedStars     *star.Star
	ExpectedError     error
	ExpectedUserStars *star.GetUserStarsResult
}

func NewStarServiceFake() *FakeStarService {
	return &FakeStarService{}
}

func (f *FakeStarService) IsStarredByUser(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	return true, f.ExpectedError
}

func (f *FakeStarService) Add(ctx context.Context, cmd *star.StarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarService) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarService) DeleteByUser(ctx context.Context, userID int64) error {
	return f.ExpectedError
}

func (f *FakeStarService) GetByUser(ctx context.Context, query *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	return f.ExpectedUserStars, f.ExpectedError
}

func (f *FakeStarService) GetStars(ctx *models.ReqContext) response.Response {
	return response.Success("ok")
}

func (f *FakeStarService) StarDashboard(ctx *models.ReqContext) response.Response {
	return response.Success("ok")
}

func (f *FakeStarService) UnstarDashboard(ctx *models.ReqContext) response.Response {
	return response.Success("ok")
}
