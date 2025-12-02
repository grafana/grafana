package collections

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

var _ grafanarest.Storage = (*datasourceStorage)(nil)

type datasourceStorage struct {
	grafanarest.Storage
}

// When using list, we really just want to get the value for the single user
func (s *datasourceStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	switch user.GetIdentityType() {
	case authlib.TypeAnonymous:
		return s.NewList(), nil

	// Get the single user stars
	case authlib.TypeUser:
		datasources := &collections.DataSourceStackList{}
		obj, _ := s.Get(ctx, "user-"+user.GetIdentifier(), &v1.GetOptions{})
		if obj != nil {
			d, ok := obj.(*collections.DataSourceStack)
			if ok {
				datasources.Items = []collections.DataSourceStack{*d}
			}
		}
		return datasources, nil

	default:
		return s.Storage.List(ctx, options)
	}
}
