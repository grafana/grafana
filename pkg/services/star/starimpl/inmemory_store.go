package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/star"
)

type inmemory struct {
	starsByUserID map[int64]map[int64]bool
}

func newInmemory() *inmemory {
	return &inmemory{starsByUserID: map[int64]map[int64]bool{}}
}

func (i *inmemory) Get(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	usrStars, hasStars := i.starsByUserID[query.UserID]
	if !hasStars {
		return false, nil
	}

	_, starred := usrStars[query.DashboardID]
	return starred, nil
}

func (i *inmemory) Insert(ctx context.Context, command *star.StarDashboardCommand) error {
	usrStars, hasStars := i.starsByUserID[command.UserID]
	if !hasStars {
		usrStars = map[int64]bool{}
	}

	usrStars[command.DashboardID] = true
	i.starsByUserID[command.UserID] = usrStars
	return nil
}

func (i *inmemory) Delete(ctx context.Context, command *star.UnstarDashboardCommand) error {
	_, hasStars := i.starsByUserID[command.UserID]
	if !hasStars {
		return nil
	}

	delete(i.starsByUserID[command.UserID], command.DashboardID)
	return nil
}

func (i *inmemory) DeleteByUser(ctx context.Context, usr int64) error {
	delete(i.starsByUserID, usr)
	return nil
}

func (i *inmemory) List(ctx context.Context, query *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	return &star.GetUserStarsResult{UserStars: i.starsByUserID[query.UserID]}, nil
}
