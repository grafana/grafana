package dashboard

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// dashboardUpdateStrategy starts every dashboard update with an empty status.
//
// A dashboard's status only holds conversion info, which describes how a read was converted
// from the stored version. The generic strategy copies the old object's status onto the update.
// When the old object was converted for the request, that status names the previous stored
// version, so a dashboard saved through v2 kept storedVersion "v1". Clients that pick an API
// version from storedVersion then wrote through the wrong version, and the conversion dropped
// fields that version cannot hold.
type dashboardUpdateStrategy struct {
	rest.RESTUpdateStrategy
}

func (s dashboardUpdateStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	s.RESTUpdateStrategy.PrepareForUpdate(ctx, obj, old)

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return
	}
	empty := obj.DeepCopyObject()
	if err := runtime.SetZeroValue(empty); err != nil {
		return
	}
	emptyMeta, err := utils.MetaAccessor(empty)
	if err != nil {
		return
	}
	if status, err := emptyMeta.GetStatus(); err == nil {
		_ = meta.SetStatus(status)
	}
}
