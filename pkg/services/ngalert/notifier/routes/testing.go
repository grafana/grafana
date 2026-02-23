package routes

import (
	"context"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

type FakeService struct {
	Service
	Config               legacy_storage.ConfigRevision
	Provenances          map[string]models.Provenance
	IncludeManagedRoutes bool
}

func NewFakeService(config legacy_storage.ConfigRevision) *FakeService {
	return &FakeService{
		Config:               config,
		Provenances:          make(map[string]models.Provenance),
		IncludeManagedRoutes: true,
	}
}

func (f *FakeService) GetManagedRoute(_ context.Context, _ int64, name string) (legacy_storage.ManagedRoute, error) {
	r := f.Config.GetManagedRoute(name)
	if r == nil {
		return legacy_storage.ManagedRoute{}, models.ErrRouteNotFound.Errorf("route %q not found", name)
	}
	if p, ok := f.Provenances[name]; ok {
		r.Provenance = p
	}
	return *r, nil
}
func (f *FakeService) GetManagedRoutes(_ context.Context, _ int64) (legacy_storage.ManagedRoutes, error) {
	routes := f.Config.GetManagedRoutes(f.IncludeManagedRoutes)
	for _, r := range routes {
		if p, ok := f.Provenances[r.Name]; ok {
			r.Provenance = p
		}
	}
	return routes, nil
}

func (f *FakeService) RenameTimeIntervalInRoutes(_ context.Context, rev *legacy_storage.ConfigRevision, oldName string, newName string) map[*apimodels.Route]int {
	return rev.RenameTimeIntervalInRoutes(oldName, newName, f.IncludeManagedRoutes)
}
