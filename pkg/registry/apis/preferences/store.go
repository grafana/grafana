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

type preferencesStorage struct {
	grafanarest.Storage
}

// [TODO] this should have a test to assert that they're returned in the correct order (org, teams, user)
// merged needs this in the right order so inheritence works correctly
// or just test in merged?

func (s *preferencesStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
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
	if options.Continue != "" {
		return nil, fmt.Errorf("continue token not supported")
	}
	if options.LabelSelector != nil && !options.LabelSelector.Empty() {
		return nil, fmt.Errorf("labelSelector not supported")
	}

	result := &preferences.PreferencesList{
		Items: make([]preferences.Preferences, 0, 10),
	}

	groups := user.GetGroups()
	if len(groups) != len(user.GetTeams()) {
		// SOMETHING IS WRONG.... these should be the same!
		return nil, fmt.Errorf("teams not resolved accurately (%v != %v)", groups, user.GetTeams())
	}

	// Append user+team preferences
	getPrefsAndAppend := func(name string) error {
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
		obj, ok := rsp.(*preferences.Preferences)
		if !ok {
			return fmt.Errorf("expected preferences, found %T", rsp)
		}
		result.Items = append(result.Items, *obj)
		return nil
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
		if err = getPrefsAndAppend(r[0].Value); err != nil {
			return nil, err
		}
		return result, nil
	}

	// Add the explicit user values
	if err = getPrefsAndAppend("user-" + user.GetIdentifier()); err != nil {
		return nil, err
	}

	// Append teams
	// [TODO] change to first 25 teams??
	if len(groups) < 25 { // Do not fetch all teams when there are too many (used for merged)

		// [todo] Is it possible to match the existing sql implementation sort (of numerical team ID?)
		// if not, should we change it to something else more... intuitive?
		slices.Sort(groups)

		for _, group := range groups {
			if err = getPrefsAndAppend("team-" + group); err != nil {
				return nil, err
			}
		}
	}

	return result, nil
}
