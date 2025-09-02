package legacy

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"

	dashboardsV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*starsStorage)(nil)
	_ rest.SingularNameProvider = (*starsStorage)(nil)
	_ rest.Getter               = (*starsStorage)(nil)
	_ rest.Lister               = (*starsStorage)(nil)
	_ rest.Storage              = (*starsStorage)(nil)
	// _ rest.Creater              = (*starsStorage)(nil)
	// _ rest.Updater              = (*starsStorage)(nil)
	// _ rest.GracefulDeleter      = (*starsStorage)(nil)
)

func NewStarsStorage(namespacer request.NamespaceMapper, sql *LegacySQL) *starsStorage {
	return &starsStorage{
		namespacer:     namespacer,
		sql:            sql,
		tableConverter: preferences.StarsResourceInfo.TableConverter(),
	}
}

type starsStorage struct {
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
	sql            *LegacySQL
}

func (s *starsStorage) New() runtime.Object {
	return preferences.StarsKind().ZeroValue()
}

func (s *starsStorage) Destroy() {}

func (s *starsStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *starsStorage) GetSingularName() string {
	return strings.ToLower(preferences.StarsKind().Kind())
}

func (s *starsStorage) NewList() runtime.Object {
	return preferences.StarsKind().ZeroListValue()
}

func (s *starsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *starsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, false)
	if err != nil {
		return nil, err
	}

	if ns.Value == "" {
		return nil, fmt.Errorf("cross cluster listing is not supported")
	}

	list := &preferences.StarsList{}
	found, rv, err := s.sql.GetStars(ctx, ns.OrgID, "")
	if err != nil {
		return nil, err
	}
	for _, v := range found {
		list.Items = append(list.Items, asStarsResource(s.namespacer(v.OrgID), &v))
	}
	if rv > 0 {
		list.ResourceVersion = strconv.FormatInt(rv, 10)
	}
	return list, nil
}

func (s *starsStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	owner, ok := utils.ParseOwnerFromName(name)
	if !ok {
		return nil, fmt.Errorf("invalid name %w", err)
	}
	if owner.Owner != utils.UserResourceOwner {
		return nil, fmt.Errorf("expecting name with prefix: %s-", utils.UserResourceOwner)
	}

	found, _, err := s.sql.GetStars(ctx, info.OrgID, owner.Name)
	if err != nil || len(found) == 0 {
		return nil, err
	}
	obj := asStarsResource(info.Value, &found[0])
	return &obj, nil
}

func asStarsResource(ns string, v *dashboardStars) preferences.Stars {
	return preferences.Stars{
		ObjectMeta: metav1.ObjectMeta{
			Name:              fmt.Sprintf("user-%s", v.UserUID),
			Namespace:         ns,
			ResourceVersion:   strconv.FormatInt(v.Last, 10),
			CreationTimestamp: metav1.NewTime(time.UnixMilli(v.First)),
		},
		Spec: preferences.StarsSpec{
			Resource: []preferences.StarsResource{{
				Group: dashboardsV1.APIGroup,
				Kind:  "Dashboard",
				Names: v.Dashboards,
			}},
		},
	}
}
