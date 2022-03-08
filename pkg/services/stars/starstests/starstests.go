package stars

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeStarsService struct {
	ExpectedStars     *models.Star
	ExpectedError     error
	ExpectedUserStars map[int64]bool
}

func NewStarsServiceFake() *FakeStarsService {
	return &FakeStarsService{}
}

func (f *FakeStarsService) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) (bool, error) {
	return true, f.ExpectedError
}

func (f *FakeStarsService) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarsService) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarsService) GetUserStars(ctx context.Context, query *models.GetUserStarsQuery) (map[int64]bool, error) {
	return f.ExpectedUserStars, f.ExpectedError
}

type FakeStarsStore struct {
	ExpectedStars     *models.Star
	ExpectedListStars []*models.Star
	ExpectedError     error
}

func NewStarsStoreFake() *FakeStarsStore {
	return &FakeStarsStore{}
}
