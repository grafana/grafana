package legacy

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/utils/ptr"

	authlib "github.com/grafana/authlib/types"
	dashboardsV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	_ rest.Scoper               = (*DashboardStarsStorage)(nil)
	_ rest.SingularNameProvider = (*DashboardStarsStorage)(nil)
	_ rest.Getter               = (*DashboardStarsStorage)(nil)
	_ rest.Lister               = (*DashboardStarsStorage)(nil)
	_ rest.Storage              = (*DashboardStarsStorage)(nil)
	_ rest.Creater              = (*DashboardStarsStorage)(nil)
	_ rest.Updater              = (*DashboardStarsStorage)(nil)
	_ rest.GracefulDeleter      = (*DashboardStarsStorage)(nil)
	_ rest.CollectionDeleter    = (*DashboardStarsStorage)(nil)
)

func NewDashboardStarsStorage(
	stars star.Service,
	users user.Service,
	namespacer request.NamespaceMapper,
	sql *LegacySQL,
) *DashboardStarsStorage {
	return &DashboardStarsStorage{
		stars:          stars,
		users:          users,
		namespacer:     namespacer,
		sql:            sql,
		tableConverter: preferences.StarsResourceInfo.TableConverter(),
	}
}

type DashboardStarsStorage struct {
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
	sql            *LegacySQL
	stars          star.Service
	users          user.Service
}

func (s *DashboardStarsStorage) New() runtime.Object {
	return preferences.StarsKind().ZeroValue()
}

func (s *DashboardStarsStorage) Destroy() {}

func (s *DashboardStarsStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *DashboardStarsStorage) GetSingularName() string {
	return strings.ToLower(preferences.StarsKind().Kind())
}

func (s *DashboardStarsStorage) NewList() runtime.Object {
	return preferences.StarsKind().ZeroListValue()
}

func (s *DashboardStarsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *DashboardStarsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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

func getNamespaceAndOwner(ctx context.Context, name string) (authlib.NamespaceInfo, utils.OwnerReference, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return info, utils.OwnerReference{}, err
	}
	owner, ok := utils.ParseOwnerFromName(name)
	if !ok {
		return info, owner, fmt.Errorf("invalid name %w", err)
	}
	if owner.Owner != utils.UserResourceOwner {
		return info, owner, fmt.Errorf("expecting name with prefix: %s-", utils.UserResourceOwner)
	}
	return info, owner, nil
}

func (s *DashboardStarsStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, owner, err := getNamespaceAndOwner(ctx, name)
	if err != nil {
		return nil, err
	}

	found, _, err := s.sql.GetStars(ctx, ns.OrgID, owner.Name)
	if err != nil || len(found) == 0 {
		return nil, err
	}
	obj := asStarsResource(ns.Value, &found[0])
	return &obj, nil
}

func (s *DashboardStarsStorage) StarDashboard(ctx context.Context, name string, uid string) (runtime.Object, error) {
	return nil, fmt.Errorf("TODO")
}

func (s *DashboardStarsStorage) UnstarDashboard(ctx context.Context, name string, uid string) (runtime.Object, error) {
	return nil, fmt.Errorf("TODO")
}

func getDashboardStars(stars *preferences.Stars) []string {
	if stars == nil || len(stars.Spec.Resource) == 0 {
		return []string{}
	}
	for _, r := range stars.Spec.Resource {
		if r.Group == "dashboard.grafana.app" && r.Kind == "Dashboard" {
			return r.Names
		}
	}
	return []string{}
}

// Create implements rest.Creater.
func (s *DashboardStarsStorage) write(ctx context.Context, obj *preferences.Stars, old *preferences.Stars) (runtime.Object, error) {
	ns, owner, err := getNamespaceAndOwner(ctx, obj.Name)
	if err != nil {
		return nil, err
	}

	user, err := s.users.GetByUID(ctx, &user.GetUserByUIDQuery{
		UID: owner.Name,
	})
	if err != nil {
		return nil, err
	}
	if user.OrgID != ns.OrgID {
		return nil, fmt.Errorf("namespace mismatch")
	}

	stars := getDashboardStars(obj)
	if len(stars) == 0 {
		err = s.stars.DeleteByUser(ctx, user.ID)
		return &preferences.Stars{ObjectMeta: metav1.ObjectMeta{
			Name:              obj.Name,
			Namespace:         obj.Namespace,
			DeletionTimestamp: ptr.To(metav1.Now()),
		}}, err
	}

	changed := false
	now := time.Now()
	randID := now.UnixNano() + rand.Int63n(5000)
	previous := make(map[string]bool)
	for _, v := range getDashboardStars(obj) {
		previous[v] = true
	}
	for _, dashboard := range stars {
		if previous[dashboard] {
			delete(previous, dashboard)
			continue // nothing needed
		}
		err = s.stars.Add(ctx, &star.StarDashboardCommand{
			UserID:       user.ID,
			OrgID:        user.OrgID,
			DashboardUID: dashboard,
			DashboardID:  randID,
			Updated:      now,
		})
		if err != nil {
			return nil, err
		}
		changed = true
		randID++
	}

	for k := range previous {
		err = s.stars.Delete(ctx, &star.UnstarDashboardCommand{
			UserID:       user.ID,
			OrgID:        user.OrgID,
			DashboardUID: k,
		})
		if err != nil {
			return nil, err
		}
		changed = true
	}

	if changed {
		return s.Get(ctx, obj.Name, &metav1.GetOptions{})
	}
	return obj, nil // nothing required
}

// Create implements rest.Creater.
func (s *DashboardStarsStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	stars, ok := obj.(*preferences.Stars)
	if !ok {
		return nil, fmt.Errorf("expected stars object")
	}

	return s.write(ctx, stars, nil)
}

// Update implements rest.Updater.
func (s *DashboardStarsStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	old, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}

	stars, ok := obj.(*preferences.Stars)
	if !ok {
		return nil, false, fmt.Errorf("expected stars object")
	}

	obj, err = s.write(ctx, stars, old.(*preferences.Stars))
	return obj, false, err
}

// Delete implements rest.GracefulDeleter.
func (s *DashboardStarsStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	obj, err := s.write(ctx, &preferences.Stars{ObjectMeta: metav1.ObjectMeta{Name: name}}, nil)
	if err != nil {
		return nil, false, err
	}
	return obj, true, err
}

// DeleteCollection implements rest.CollectionDeleter.
func (s *DashboardStarsStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("not implemented yet")
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
