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
	requestK8s "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	utilsOrig "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*preferenceStorage)(nil)
	_ rest.SingularNameProvider = (*preferenceStorage)(nil)
	_ rest.Getter               = (*preferenceStorage)(nil)
	_ rest.Lister               = (*preferenceStorage)(nil)
	_ rest.Storage              = (*preferenceStorage)(nil)
	// _ rest.Creater              = (*preferenceStorage)(nil)
	// _ rest.Updater              = (*preferenceStorage)(nil)
	// _ rest.GracefulDeleter      = (*preferenceStorage)(nil)
)

func NewPreferencesStorage(namespacer request.NamespaceMapper, sql *LegacySQL) *preferenceStorage {
	return &preferenceStorage{
		namespacer:     namespacer,
		sql:            sql,
		tableConverter: preferences.PreferencesResourceInfo.TableConverter(),
	}
}

type preferenceStorage struct {
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
	sql            *LegacySQL
}

func (s *preferenceStorage) New() runtime.Object {
	return preferences.PreferencesKind().ZeroValue()
}

func (s *preferenceStorage) Destroy() {}

func (s *preferenceStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *preferenceStorage) GetSingularName() string {
	return strings.ToLower(preferences.PreferencesKind().Kind())
}

func (s *preferenceStorage) NewList() runtime.Object {
	return preferences.PreferencesKind().ZeroListValue()
}

func (s *preferenceStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *preferenceStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	ns := requestK8s.NamespaceValue(ctx)
	userID := user.GetUID()
	if user.GetIsGrafanaAdmin() {
		userID = "" // everything in the namespace
	}
	return s.sql.ListPreferences(ctx, ns, userID, true)
}

func (s *preferenceStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	owner, ok := utils.ParseOwnerFromName(name)
	if !ok {
		return nil, preferences.PreferencesResourceInfo.NewNotFound(name)
	}

	found, _, err := s.sql.listPreferences(ctx, ns.Value, ns.OrgID, func(req *preferencesQuery) (bool, error) {
		switch owner.Owner {
		case utils.UserResourceOwner:
			req.UserUID = owner.Name
			return false, nil
		case utils.TeamResourceOwner:
			req.TeamUID = owner.Name
			return false, nil
		default:
			return false, fmt.Errorf("unsupported name")
		}
	})
	if err != nil {
		return nil, err
	}

	if len(found) == 1 {
		return &found[0], nil
	}
	return nil, preferences.PreferencesResourceInfo.NewNotFound(name)
}

func asPreferencesResource(ns string, p *preferenceModel) preferences.Preferences {
	owner := utils.OwnerReference{}
	if p.TeamUID.Valid {
		owner.Owner = utils.TeamResourceOwner
		owner.Name = p.TeamUID.String
	} else {
		owner.Owner = utils.UserResourceOwner
		owner.Name = p.UserUID.String
	}
	obj := preferences.Preferences{
		ObjectMeta: metav1.ObjectMeta{
			Name:              owner.AsName(),
			Namespace:         ns,
			ResourceVersion:   strconv.FormatInt(p.Updated.UnixMilli(), 10),
			CreationTimestamp: metav1.NewTime(p.Created.UTC()),
		},
		Spec: preferences.PreferencesSpec{
			Theme:            asPointer(p.Theme.String),
			HomeDashboardUID: asPointer(p.HomeDashboardUID.String),
			Timezone:         asPointer(p.Timezone.String),
			WeekStart:        asPointer(p.WeekStart.String),
		},
	}

	if !p.Created.Equal(p.Updated) {
		obj.Annotations = map[string]string{
			utilsOrig.AnnoKeyUpdatedTimestamp: p.Updated.UTC().Format(time.RFC3339),
		}
	}

	if p.JSONData != nil {
		obj.Spec.Language = asPointer(p.JSONData.Language)
		obj.Spec.RegionalFormat = asPointer(p.JSONData.RegionalFormat)

		if p.JSONData.QueryHistory.HomeTab != "" {
			obj.Spec.QueryHistory = &preferences.PreferencesQueryHistoryPreference{
				HomeTab: &p.JSONData.QueryHistory.HomeTab,
			}
		}

		if len(p.JSONData.CookiePreferences) > 0 {
			// Analytics   interface{} `json:"analytics,omitempty"`
			// Performance interface{} `json:"performance,omitempty"`
			// Functional  interface{} `json:"functional,omitempty"`
			obj.Spec.CookiePreferences = preferences.NewPreferencesCookiePreferences()
			v, ok := p.JSONData.CookiePreferences["analytics"]
			if ok {
				obj.Spec.CookiePreferences.Analytics = v
			}
			v, ok = p.JSONData.CookiePreferences["performance"]
			if ok {
				obj.Spec.CookiePreferences.Performance = v
			}
			v, ok = p.JSONData.CookiePreferences["functional"]
			if ok {
				obj.Spec.CookiePreferences.Functional = v
			}
		}

		if len(p.JSONData.Navbar.BookmarkUrls) > 0 {
			obj.Spec.Navbar = &preferences.PreferencesNavbarPreference{
				BookmarkUrls: p.JSONData.Navbar.BookmarkUrls,
			}
		}
	}

	return obj
}

func asPointer(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}
