package apistore

import (
	"context"
	"time"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Called on create
func (s *Storage) prepareObjectForStorage(ctx context.Context, obj runtime.Object) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	err = s.Versioner().PrepareObjectForStorage(obj)
	if err != nil {
		return err
	}

	access, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}

	// Read+write will verify that origin format is accurate
	origin, err := access.GetOriginInfo()
	if err != nil {
		return err
	}
	access.SetOriginInfo(origin)
	access.SetUpdatedBy("")
	access.SetUpdatedTimestamp(nil)
	access.SetCreatedBy(user.GetUID().String())
	return nil
}

// Called on update
func (s *Storage) prepareObjectForUpdate(ctx context.Context, updateObject runtime.Object, previousObject runtime.Object) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	obj, err := utils.MetaAccessor(updateObject)
	if err != nil {
		return err
	}

	previous, err := utils.MetaAccessor(previousObject)
	if err != nil {
		return err
	}
	obj.SetUID(previous.GetUID())
	obj.SetCreatedBy(previous.GetCreatedBy())
	obj.SetCreationTimestamp(previous.GetCreationTimestamp())

	// Read+write will verify that origin format is accurate
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return err
	}
	obj.SetOriginInfo(origin)
	obj.SetUpdatedBy(user.GetUID().String())
	obj.SetUpdatedTimestampMillis(time.Now().UnixMilli())
	return nil
}
