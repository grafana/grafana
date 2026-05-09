package preferences

import (
	"context"
	"fmt"
	"slices"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"

	authlib "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

// preferencesStorage wraps a regular storage backend, replacing the default list behavior
// Rather than returning all preferences and filtering with the authz client (where there is not yet support for preferences)
// This converts the query into explicitly picking the preferences the caller should have access
type preferencesStorage struct {
	grafanarest.Storage
}

func (s *preferencesStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return s.ListPreferences(ctx, options)
}

// ListPreferences wraps a regular storage object and populates the results with:
// 1. user preferences (if they exist)
// 2. team preferences (if they exist) for the first 25 groups sorted by UID
// 3. namespace (org) preferences (if they exist)
// The preferences/merged call will merge these all into a single object keeping the first property defined
func (s *preferencesStorage) ListPreferences(ctx context.Context, options *internalversion.ListOptions) (*preferences.PreferencesList, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if user.GetIdentityType() != authlib.TypeUser {
		return nil, fmt.Errorf("only users may list preferences")
	}
	if user.GetIdentifier() == "" {
		return nil, fmt.Errorf("user identifier is required")
	}
	if options == nil {
		options = &internalversion.ListOptions{}
	}

	if options.Continue != "" {
		return nil, fmt.Errorf("continue token not supported")
	}
	if options.LabelSelector != nil && !options.LabelSelector.Empty() {
		return nil, fmt.Errorf("labelSelector not supported")
	}

	groups := user.GetGroups()

	result := &preferences.PreferencesList{
		Items: make([]preferences.Preferences, 0, len(groups)+2),
	}

	// Append user+team preferences
	addPreferencesToResult := func(name string) error {
		// GetPreferenceAndAppendToResults
		info, _ := utils.ParseOwnerFromName(name)
		switch info.Owner {
		case utils.NamespaceResourceOwner:
			// OK
		case utils.UserResourceOwner:
			if user.GetIdentifier() != info.Identifier {
				return nil
			}
		case utils.TeamResourceOwner:
			if !slices.Contains(groups, info.Identifier) {
				return nil
			}
		default:
			return nil // skip
		}

		rsp, err := s.Get(ctx, name, &metav1.GetOptions{})
		if k8serrors.IsNotFound(err) {
			return nil // don't add it to the list
		}
		if rsp != nil {
			obj, ok := rsp.(*preferences.Preferences)
			if !ok {
				return fmt.Errorf("expected preferences, found %T", rsp)
			}
			result.Items = append(result.Items, *obj)
		}
		return err
	}

	// Try getting an explicit preferences
	if options.FieldSelector != nil && !options.FieldSelector.Empty() {
		r := options.FieldSelector.Requirements()
		if len(r) != 1 {
			return nil, fmt.Errorf("only one fieldSelector is supported")
		}
		if r[0].Field != "metadata.name" {
			return nil, fmt.Errorf("only the metadata.name fieldSelector is supported")
		}
		if r[0].Operator != selection.Equals {
			return nil, fmt.Errorf("only the = operator is supported")
		}
		if err = addPreferencesToResult(r[0].Value); err != nil {
			return nil, err
		}
		return result, nil
	}

	// Add the explicit user values
	if err = addPreferencesToResult("user-" + user.GetIdentifier()); err != nil {
		return nil, err
	}

	// predictable order
	slices.Sort(groups)
	for i, group := range groups {
		if i >= 25 {
			break // only process the fist 25 -- to keep it bounded
		}
		if err = addPreferencesToResult("team-" + group); err != nil {
			return nil, err
		}
	}

	// Add the org flavor
	if err = addPreferencesToResult(string(utils.NamespaceResourceOwner)); err != nil {
		return nil, err
	}

	return result, nil
}
