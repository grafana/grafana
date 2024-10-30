package userstorage

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
)

type userstorageCreateStrategy struct {
	rest.RESTCreateStrategy
}

func newStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion) *userstorageCreateStrategy {
	genericStrategy := grafanaregistry.NewStrategy(typer, gv)
	return &userstorageCreateStrategy{genericStrategy}
}

// Validate ensures that when creating a userstorage object, the name matches the user id.
func (g *userstorageCreateStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	u, err := identity.GetRequester(ctx)
	if err != nil {
		return field.ErrorList{field.InternalError(nil, fmt.Errorf("failed to get requester: %v", err))}
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return field.ErrorList{field.InternalError(nil, fmt.Errorf("failed to get meta accessor: %v", err))}
	}
	if u.GetUID() != meta.GetName() {
		return field.ErrorList{field.Forbidden(field.NewPath("metadata").Child("name"), "name must match user id")}
	}

	return field.ErrorList{}
}
