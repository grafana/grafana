package userstorage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	// Target for user storage size < 3MB
	userstorageSize = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "userstorage",
		Name:      "size",
		Help:      "The current size in bytes of the user storage for a service",
	}, []string{"name"})
)

type genericStrategy interface {
	rest.RESTCreateStrategy
	rest.RESTUpdateStrategy
}

type userstorageStrategy struct {
	genericStrategy

	registerer prometheus.Registerer
}

var once sync.Once

func newStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion, registerer prometheus.Registerer) *userstorageStrategy {
	once.Do(func() {
		if registerer != nil {
			registerer.MustRegister(
				userstorageSize,
			)
		}
	})
	genericStrategy := grafanaregistry.NewStrategy(typer, gv)
	return &userstorageStrategy{genericStrategy, registerer}
}

func compareResourceNameAndUserUID(name string, u identity.Requester) bool {
	// ObjectMeta.Name should follow the format <service>:<user_uid>
	nameSplit := strings.Split(name, ":")
	if len(nameSplit) != 2 {
		return false
	}
	objUserUID := nameSplit[1]

	// u.GetUID() returns user:<user_uid> so we need to remove the user: prefix
	userUID := strings.Split(u.GetUID(), ":")
	if len(userUID) != 2 {
		return false
	}

	return objUserUID == userUID[1]
}

func registerSize(obj runtime.Object) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return
	}

	b := new(bytes.Buffer)
	if err := json.NewEncoder(b).Encode(obj); err != nil {
		return
	}
	userstorageSize.WithLabelValues(meta.GetName()).Set(float64(b.Len()))
}

// Validate ensures that when creating a userstorage object, the name matches the user id.
func (g *userstorageStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	u, err := identity.GetRequester(ctx)
	if err != nil {
		return field.ErrorList{field.InternalError(nil, fmt.Errorf("failed to get requester: %v", err))}
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return field.ErrorList{field.InternalError(nil, fmt.Errorf("failed to get meta accessor: %v", err))}
	}

	nameMatch := compareResourceNameAndUserUID(meta.GetName(), u)
	if !nameMatch {
		return field.ErrorList{field.Forbidden(field.NewPath("metadata").Child("name"), "name must match service:user_uid")}
	}

	registerSize(obj)
	return field.ErrorList{}
}

func (g *userstorageStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	registerSize(obj)
	return field.ErrorList{}
}
