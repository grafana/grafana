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

	authlib "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	utilsOrig "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

var (
	_ rest.Scoper               = (*preferenceStorage)(nil)
	_ rest.SingularNameProvider = (*preferenceStorage)(nil)
	_ rest.Getter               = (*preferenceStorage)(nil)
	_ rest.Lister               = (*preferenceStorage)(nil)
	_ rest.Storage              = (*preferenceStorage)(nil)
	_ rest.Creater              = (*preferenceStorage)(nil)
	_ rest.Updater              = (*preferenceStorage)(nil)
	_ rest.GracefulDeleter      = (*preferenceStorage)(nil)
)

func NewPreferencesStorage(pref pref.Service, namespacer request.NamespaceMapper, sql *LegacySQL) *preferenceStorage {
	return &preferenceStorage{
		prefs:          pref,
		namespacer:     namespacer,
		sql:            sql,
		tableConverter: preferences.PreferencesResourceInfo.TableConverter(),
	}
}

type preferenceStorage struct {
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
	sql            *LegacySQL
	prefs          pref.Service
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
	if user.GetIdentityType() == authlib.TypeAccessPolicy {
		user = nil // nill user can see everything
	}
	return s.sql.ListPreferences(ctx, ns, user, true)
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

	// NOTE: the authorizer already checked if this request is allowed
	found, _, err := s.sql.listPreferences(ctx, ns.Value, ns.OrgID, func(req *preferencesQuery) (bool, error) {
		switch owner.Owner {
		case utils.UserResourceOwner:
			req.UserUID = owner.Identifier
			return false, nil
		case utils.TeamResourceOwner:
			req.TeamUID = owner.Identifier
			return false, nil
		case utils.NamespaceResourceOwner:
			return false, nil
		default:
			return false, fmt.Errorf("unsupported name")
		}
	}, func(p *preferenceModel) bool {
		return true
	})
	if err != nil {
		return nil, err
	}

	if len(found) == 1 {
		return &found[0], nil
	}
	return nil, preferences.PreferencesResourceInfo.NewNotFound(name)
}

func (s *preferenceStorage) save(ctx context.Context, obj runtime.Object) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	p, ok := obj.(*preferences.Preferences)
	if !ok {
		return nil, fmt.Errorf("expected preferences")
	}

	owner, ok := utils.ParseOwnerFromName(p.Name)
	if !ok {
		return nil, fmt.Errorf("invalid name")
	}

	cmd := &pref.SavePreferenceCommand{
		OrgID:            user.GetOrgID(),
		HomeDashboardUID: p.Spec.HomeDashboardUID,
	}
	if p.Spec.Timezone != nil {
		cmd.Timezone = *p.Spec.Timezone
	}
	if p.Spec.WeekStart != nil {
		cmd.WeekStart = *p.Spec.WeekStart
	}
	if p.Spec.Theme != nil {
		cmd.Theme = *p.Spec.Theme
	}
	if p.Spec.Language != nil {
		cmd.Language = *p.Spec.Language
	}
	if p.Spec.RegionalFormat != nil {
		cmd.RegionalFormat = *p.Spec.RegionalFormat
	}
	if p.Spec.QueryHistory != nil {
		cmd.QueryHistory = &pref.QueryHistoryPreference{
			HomeTab: *p.Spec.QueryHistory.HomeTab,
		}
	}
	if p.Spec.Navbar != nil {
		cmd.Navbar = &pref.NavbarPreference{
			BookmarkUrls: p.Spec.Navbar.BookmarkUrls,
		}
	}
	if p.Spec.CookiePreferences != nil {
		cmd.CookiePreferences = []pref.CookieType{}
		if p.Spec.CookiePreferences.Analytics != nil {
			cmd.CookiePreferences = append(cmd.CookiePreferences, "analytics")
		}
		if p.Spec.CookiePreferences.Functional != nil {
			cmd.CookiePreferences = append(cmd.CookiePreferences, "functional")
		}
		if p.Spec.CookiePreferences.Performance != nil {
			cmd.CookiePreferences = append(cmd.CookiePreferences, "performance")
		}
	}

	switch owner.Owner {
	case utils.NamespaceResourceOwner:
		// the org ID is already set

	case utils.UserResourceOwner:
		if user.GetIdentifier() != owner.Identifier {
			return nil, fmt.Errorf("only the user can save preferences")
		}
		cmd.UserID, err = user.GetInternalID()
		if err != nil {
			return nil, err
		}
	case utils.TeamResourceOwner:
		cmd.TeamID, err = s.sql.getLegacyTeamID(ctx, user.GetOrgID(), owner.Identifier)
		if err != nil {
			return nil, err
		}

	default:
		return nil, fmt.Errorf("unsupported name")
	}

	if err = s.prefs.Save(ctx, cmd); err != nil {
		return nil, err
	}
	return s.Get(ctx, owner.AsName(), &metav1.GetOptions{})
}

// Create implements rest.Creater.
func (s *preferenceStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	return s.save(ctx, obj)
}

// Update implements rest.Updater.
func (s *preferenceStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	old, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}

	obj, err = s.save(ctx, obj)
	return obj, false, err
}

// Delete implements rest.GracefulDeleter.
func (s *preferenceStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	owner, ok := utils.ParseOwnerFromName(name)
	if !ok {
		return nil, false, fmt.Errorf("invalid name")
	}

	cmd := &pref.DeleteCommand{}

	switch owner.Owner {
	case utils.TeamResourceOwner:
		cmd.TeamID, err = user.GetInternalID()
		if err != nil {
			return nil, false, err
		}

	case utils.UserResourceOwner:
		cmd.UserID, err = user.GetInternalID()
		if err != nil {
			return nil, false, err
		}

	case utils.NamespaceResourceOwner:
		cmd.OrgID = user.GetOrgID()

	default:
		return nil, false, fmt.Errorf("unsupported owner")
	}

	err = s.prefs.Delete(ctx, cmd)
	return nil, (err == nil), err
}

func asPreferencesResource(ns string, p *preferenceModel) preferences.Preferences {
	owner := utils.OwnerReference{}
	if p.TeamUID.Valid {
		owner.Owner = utils.TeamResourceOwner
		owner.Identifier = p.TeamUID.String
	} else if p.UserUID.Valid {
		owner.Owner = utils.UserResourceOwner
		owner.Identifier = p.UserUID.String
	} else {
		owner.Owner = utils.NamespaceResourceOwner
		owner.Identifier = ""
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
