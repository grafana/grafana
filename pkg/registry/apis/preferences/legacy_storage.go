package preferences

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        pref.Service
	resourceInfo   *utils.ResourceInfo
	tableConverter rest.TableConvertor
}

func NewLegacyStorage(s pref.Service) *legacyStorage {
	return &legacyStorage{
		service:        s,
		resourceInfo:   &preferences.PreferencesResourceInfo,
		tableConverter: preferences.PreferencesResourceInfo.TableConverter(),
	}
}

func (s *legacyStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) fetchRelevantValues(ctx context.Context, user identity.Requester) (*preferences.PreferencesList, error) {
	if user == nil {
		return nil, fmt.Errorf("expected requester")
	}
	ns := user.GetNamespace()
	list := &preferences.PreferencesList{}

	// Namespace
	//------------
	p, err := s.service.Get(ctx, &pref.GetPreferenceQuery{
		OrgID: user.GetOrgID(),
	})
	if err == nil && p != nil {
		list.Items = append(list.Items, toObj(ns, "namespace", p))
	}

	// User
	//------------
	legacyID, err := user.GetInternalID()
	if err != nil {
		return nil, err
	}
	p, err = s.service.Get(ctx, &pref.GetPreferenceQuery{
		OrgID:  user.GetOrgID(),
		UserID: legacyID,
	})
	if err == nil && p != nil {
		list.Items = append(list.Items, toObj(ns, user.GetUID(), p))
	}

	// TEAMS
	// --------------
	for _, teamID := range user.GetTeams() {
		p, err = s.service.Get(ctx, &pref.GetPreferenceQuery{
			OrgID:  user.GetOrgID(),
			TeamID: teamID,
		})
		if err == nil && p != nil {
			list.Items = append(list.Items, toObj(ns, fmt.Sprintf("team:%v", teamID), p)) // TODO... replace with UID
		}
	}
	return list, nil
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	return s.fetchRelevantValues(ctx, user)
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	list, err := s.fetchRelevantValues(ctx, user)
	if err != nil {
		return nil, err
	}

	for _, v := range list.Items {
		if v.Name == name {
			return &v, nil
		}
	}

	return nil, s.resourceInfo.NewNotFound(name)
}

func toObj(ns string, name string, p *pref.Preference) preferences.Preferences {
	obj := preferences.Preferences{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:         ns,
			Name:              name,
			Generation:        int64(p.Version),
			CreationTimestamp: metav1.NewTime(p.Created),
		},
		Spec: preferences.PreferencesSpec{
			Theme:            asPointer(p.Theme),
			HomeDashboardUID: asPointer(p.HomeDashboardUID),
			Timezone:         asPointer(p.Timezone),
			WeekStart:        asPointer2(p.WeekStart),
		},
	}

	if p.Created != p.Updated {
		obj.Annotations = map[string]string{
			utils.AnnoKeyUpdatedTimestamp: p.Updated.UTC().Format(time.RFC3339),
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

func asPointer2(v *string) *string {
	if v == nil || *v == "" {
		return nil
	}
	return v
}

func asPointer(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}
