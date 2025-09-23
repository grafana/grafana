package dashboard

import (
	"context"
	"fmt"
	"strconv"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*LibraryPanelStore)(nil)
	_ rest.SingularNameProvider = (*LibraryPanelStore)(nil)
	_ rest.Getter               = (*LibraryPanelStore)(nil)
	_ rest.Lister               = (*LibraryPanelStore)(nil)
	_ rest.Storage              = (*LibraryPanelStore)(nil)
)

type LibraryPanelStore struct {
	Access       legacy.DashboardAccess
	ResourceInfo utils.ResourceInfo
}

func (s *LibraryPanelStore) New() runtime.Object {
	return s.ResourceInfo.NewFunc()
}

func (s *LibraryPanelStore) Destroy() {}

func (s *LibraryPanelStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *LibraryPanelStore) GetSingularName() string {
	return s.ResourceInfo.GetSingularName()
}

func (s *LibraryPanelStore) NewList() runtime.Object {
	return s.ResourceInfo.NewListFunc()
}

func (s *LibraryPanelStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.ResourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *LibraryPanelStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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
	return s.Access.GetLibraryPanels(ctx, query)
}

func (s *LibraryPanelStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	query := legacy.LibraryPanelQuery{
		OrgID: ns.OrgID,
		UID:   name,
		Limit: 1,
	}
	found, err := s.Access.GetLibraryPanels(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(found.Items) == 1 {
		return &found.Items[0], nil
	}
	return nil, s.ResourceInfo.NewNotFound(name)
}
