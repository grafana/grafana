package dashboard

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*libraryPanelStore)(nil)
	_ rest.SingularNameProvider = (*libraryPanelStore)(nil)
	_ rest.Getter               = (*libraryPanelStore)(nil)
	_ rest.Lister               = (*libraryPanelStore)(nil)
	_ rest.Storage              = (*libraryPanelStore)(nil)
)

var lpr = dashboard.LibraryPanelResourceInfo

type libraryPanelStore struct {
	access legacy.DashboardAccess
}

func (s *libraryPanelStore) New() runtime.Object {
	return lpr.NewFunc()
}

func (s *libraryPanelStore) Destroy() {}

func (s *libraryPanelStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *libraryPanelStore) GetSingularName() string {
	return lpr.GetSingularName()
}

func (s *libraryPanelStore) NewList() runtime.Object {
	return lpr.NewListFunc()
}

func (s *libraryPanelStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return lpr.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *libraryPanelStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	query := legacy.LibraryPanelQuery{
		OrgID: ns.OrgID,
		Limit: options.Limit,
	}
	if options.Continue != "" {
		query.LastID, err = strconv.ParseInt(options.Continue, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid continue token")
		}
	}
	if query.Limit < 1 {
		query.Limit = 25
	}
	return s.access.GetLibraryPanels(ctx, query)
}

func (s *libraryPanelStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	query := legacy.LibraryPanelQuery{
		OrgID: ns.OrgID,
		UID:   name,
		Limit: 1,
	}
	found, err := s.access.GetLibraryPanels(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(found.Items) == 1 {
		return &found.Items[0], nil
	}
	return nil, lpr.NewNotFound(name)
}
