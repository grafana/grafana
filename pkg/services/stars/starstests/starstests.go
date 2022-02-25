package stars

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeStarsService struct {
	ExpectedStars *models.Star
	ExpectedError error
}

func NewStarsServiceFake() *FakeStarsService {
	return &FakeStarsService{}
}

func (f *FakeStarsService) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error {
	return f.ExpectedError
}

func (f *FakeStarsService) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarsService) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarsService) GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) error {
	return f.ExpectedError
}

type FakeStarsStore struct {
	ExpectedStars     *models.Star
	ExpectedListStars []*models.Star
	ExpectedError     error
}

func NewStarsStoreFake() *FakeStarsStore {
	return &FakeStarsStore{}
}
