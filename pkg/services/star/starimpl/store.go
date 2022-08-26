package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/star"
)

type store interface {
	Get(context.Context, *star.IsStarredByUserQuery) (bool, error)
	Insert(context.Context, *star.StarDashboardCommand) error
	Delete(context.Context, *star.UnstarDashboardCommand) error
	DeleteByUser(context.Context, int64) error
	List(context.Context, *star.GetUserStarsQuery) (*star.GetUserStarsResult, error)
}

type storageType int64

const (
	sqlTable  storageType = 0
	fileSys   storageType = 1
	fileTable storageType = 2
)

type compositeStore struct {
	stores      map[storageType]store
	mainStorage storageType
}

// The implementation should be similar for all services
func (s compositeStore) Insert(ctx context.Context, cmd *star.StarDashboardCommand) error {
	for key, ele := range s.stores {
		if err := ele.Insert(ctx, cmd); err != nil {
			if key == s.mainStorage {
				return err
			}
			// log error here for the failure for no mainstorage
		}
	}
	return nil
}

func (s compositeStore) Get(ctx context.Context, cmd *star.IsStarredByUserQuery) (bool, error) {
	return s.stores[s.mainStorage].Get(ctx, cmd)
}

func (s compositeStore) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	for key, ele := range s.stores {
		if err := ele.Delete(ctx, cmd); err != nil {
			if key == s.mainStorage {
				return err
			}
			// log error here for the failure for no mainstorage
		}
	}
	return nil
}

func (s compositeStore) List(ctx context.Context, cmd *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	return s.stores[s.mainStorage].List(ctx, cmd)
}

func (s compositeStore) DeleteByUser(ctx context.Context, cmd int64) error {
	for key, ele := range s.stores {
		if err := ele.DeleteByUser(ctx, cmd); err != nil {
			if key == s.mainStorage {
				return err
			}
			// log error here for the failure for no mainstorage
		}
	}
	return nil
}
