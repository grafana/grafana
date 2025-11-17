package preferences

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	authlib "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

var _ grafanarest.Storage = (*starStorage)(nil)

type starStorage struct {
	grafanarest.Storage
}

// When using list, we really just want to get the value for the single user
func (s *starStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	switch user.GetIdentityType() {
	case authlib.TypeAnonymous:
		return s.NewList(), nil

	// Get the single user stars
	case authlib.TypeUser:
		stars := &preferences.StarsList{}
		obj, _ := s.Get(ctx, "user-"+user.GetIdentifier(), &v1.GetOptions{})
		if obj != nil {
			s, ok := obj.(*preferences.Stars)
			if ok {
				stars.Items = []preferences.Stars{*s}
			}
		}
		return stars, nil

	default:
		return s.Storage.List(ctx, options)
	}
}
