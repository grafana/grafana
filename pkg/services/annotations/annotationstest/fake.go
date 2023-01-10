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

	if params.Id != 0 {
		delete(repo.annotations, params.Id)
	} else {
		for _, v := range repo.annotations {
			if params.DashboardId == v.DashboardId && params.PanelId == v.PanelId {
				delete(repo.annotations, v.Id)
			}
		}
	}

	return nil
}

func (repo *fakeAnnotationsRepo) Save(ctx context.Context, item *annotations.Item) error {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()

	if item.Id == 0 {
		item.Id = int64(len(repo.annotations) + 1)
	}
	repo.annotations[item.Id] = *item

	return nil
}

func (repo *fakeAnnotationsRepo) SaveMany(ctx context.Context, items []annotations.Item) error {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()

	for _, i := range items {
		if i.Id == 0 {
			i.Id = int64(len(repo.annotations) + 1)
		}
		repo.annotations[i.Id] = i
	}

	return nil
}

func (repo *fakeAnnotationsRepo) Update(_ context.Context, item *annotations.Item) error {
	return nil
}

func (repo *fakeAnnotationsRepo) Find(_ context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	repo.mtx.Lock()
	defer repo.mtx.Unlock()

	if annotation, has := repo.annotations[query.AnnotationId]; has {
		return []*annotations.ItemDTO{{Id: annotation.Id, DashboardId: annotation.DashboardId}}, nil
	}
	annotations := []*annotations.ItemDTO{{Id: 1, DashboardId: 0}}
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
