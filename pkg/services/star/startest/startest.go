package startest

import (
	"context"

	starmodel "github.com/grafana/grafana/pkg/models"
)

type FakeStarService struct {
	ExpectedStars     *starmodel.Star
	ExpectedError     error
	ExpectedUserStars map[int64]bool
}

func NewStarServiceFake() *FakeStarService {
	return &FakeStarService{}
}

func (f *FakeStarService) IsStarredByUserCtx(ctx context.Context, query *starmodel.IsStarredByUserQuery) (bool, error) {
	return true, f.ExpectedError
}

func (f *FakeStarService) StarDashboard(ctx context.Context, cmd *starmodel.StarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarService) UnstarDashboard(ctx context.Context, cmd *starmodel.UnstarDashboardCommand) error {
	return f.ExpectedError
}

func (f *FakeStarService) GetUserStars(ctx context.Context, query *starmodel.GetUserStarsQuery) (map[int64]bool, error) {
	return f.ExpectedUserStars, f.ExpectedError
}

type FakeStarStore struct {
	ExpectedStars     *starmodel.Star
	ExpectedListStars []*starmodel.Star
	ExpectedError     error
}

func NewStarStoreFake() *FakeStarStore {
	return &FakeStarStore{}
}
