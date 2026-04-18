package annotationstest

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/services/annotations"
)

type fakeAnnotationsRepo struct {
	mtx         sync.Mutex
	annotations map[int64]annotations.Item
}

func NewFakeAnnotationsRepo() *fakeAnnotationsRepo {
	return &fakeAnnotationsRepo{
		annotations: map[int64]annotations.Item{},
	}
}

func (repo *fakeAnnotationsRepo) Delete(_ context.Context, params *annotations.DeleteParams) error {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()

	if params.ID != 0 {
		delete(repo.annotations, params.ID)
	} else {
		for _, v := range repo.annotations {
			if params.DashboardUID == v.DashboardUID && params.PanelID == v.PanelID {
				delete(repo.annotations, v.ID)
			}
		}
	}

	return nil
}

func (repo *fakeAnnotationsRepo) Save(ctx context.Context, item *annotations.Item) error {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()

	if item.ID == 0 {
		item.ID = int64(len(repo.annotations) + 1)
	}
	repo.annotations[item.ID] = *item

	return nil
}

func (repo *fakeAnnotationsRepo) SaveMany(ctx context.Context, items []annotations.Item) error {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()

	for _, i := range items {
		if i.ID == 0 {
			i.ID = int64(len(repo.annotations) + 1)
		}
		repo.annotations[i.ID] = i
	}

	return nil
}

func (repo *fakeAnnotationsRepo) Update(_ context.Context, item *annotations.Item) error {
	return nil
}

func (repo *fakeAnnotationsRepo) Find(_ context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()

	if annotation, has := repo.annotations[query.AnnotationID]; has {
		return []*annotations.ItemDTO{{ID: annotation.ID, DashboardID: annotation.DashboardID, DashboardUID: &annotation.DashboardUID}}, nil // nolint: staticcheck
	}
	annotations := []*annotations.ItemDTO{{ID: 1, DashboardID: 0}}
	return annotations, nil
}

func (repo *fakeAnnotationsRepo) FindTags(_ context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	result := annotations.FindTagsResult{
		Tags: []*annotations.TagsDTO{},
	}
	return result, nil
}

func (repo *fakeAnnotationsRepo) Len() int {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()

	return len(repo.annotations)
}

func (repo *fakeAnnotationsRepo) Items() map[int64]annotations.Item {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()
	ret := make(map[int64]annotations.Item)
	for k, v := range repo.annotations {
		ret[k] = v
	}
	return ret
}
