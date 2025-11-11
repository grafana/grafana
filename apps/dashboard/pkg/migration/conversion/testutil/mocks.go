package testutil

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// FakeLibraryPanelService implements the subset of methods used in conversion tests
// to supply library panel models by UID.
type FakeLibraryPanelService struct {
	UIDToModel map[string]map[string]any
}

func (f *FakeLibraryPanelService) ConnectLibraryPanelsForDashboard(_ context.Context, _ identity.Requester, _ *dashboards.Dashboard) error {
	return nil
}

func (f *FakeLibraryPanelService) ImportLibraryPanelsForDashboard(_ context.Context, _ identity.Requester, _ *simplejson.Json, _ []any, _ int64, _ string) error {
	return nil
}

func (f *FakeLibraryPanelService) GetPanelModelByUID(_ context.Context, _ identity.Requester, uid string) (map[string]interface{}, error) {
	if f.UIDToModel == nil {
		return nil, fmt.Errorf("no models configured")
	}
	m, ok := f.UIDToModel[uid]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return m, nil
}
