package utils

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type ResourceMetaMutator interface {
	// Update the grafana.app annotations for create
	// The user will be read from the context
	PrepareObjectForCreate(ctx context.Context, obj runtime.Object) error

	// Update the grafana.app annotations for update
	// The user will be read from the context
	PrepareObjectForUpdate(ctx context.Context, obj runtime.Object, oldObj runtime.Object) error
}

func NewResourceMetaMutator(supportFolders bool) ResourceMetaMutator {
	helper := &storageMetaHelper{}
	if supportFolders {
		helper.folderCheck = func(ctx context.Context, user identity.Requester, uid string) bool {
			return true // This should eventually check with FGAC
		}
	}
	return helper
}

type storageMetaHelper struct {
	// Callback function that indicates if a user can write to a specified folder
	folderCheck func(ctx context.Context, user identity.Requester, uid string) bool

	// Callback function that indicates if a user can link to a specified origin
	originCheck func(ctx context.Context, user identity.Requester, origin string) bool
}

// Make sure we
var _ = ResourceMetaMutator(&storageMetaHelper{})

func (s *storageMetaHelper) verify(ctx context.Context, user identity.Requester, meta GrafanaResourceMetaAccessor) error {
	// Do not allow people to write object to folders when not supported
	folder := meta.GetFolder()
	if folder != "" {
		if s.folderCheck == nil {
			return fmt.Errorf("folders are not supported for this resource")
		}
		if !s.folderCheck(ctx, user, folder) {
			return fmt.Errorf("unable to write object to folder")
		}
	}

	// Ensure the origin properties are clean
	origin, err := meta.GetOriginInfo()
	if origin != nil && s.originCheck != nil {
		if !s.originCheck(ctx, user, origin.Name) {
			return fmt.Errorf("unable to write object origin info")
		}
	}
	meta.SetOriginInfo(origin) // Writing it will clean up any bad inputs
	return err
}

func (s *storageMetaHelper) PrepareObjectForCreate(ctx context.Context, obj runtime.Object) error {
	user, err := appcontext.User(ctx)
	if err != nil {
		return err
	}

	meta, err := MetaAccessor(obj)
	if err != nil {
		return err
	}

	meta.SetCreatedBy(user.GetID().String())
	meta.SetUpdatedBy("")
	meta.SetUpdatedTimestamp(nil)
	return s.verify(ctx, user, meta)
}

func (s *storageMetaHelper) PrepareObjectForUpdate(ctx context.Context, obj runtime.Object, oldObj runtime.Object) error {
	// If the old object does not exist, this is really a create function
	if oldObj == nil {
		return s.PrepareObjectForCreate(ctx, obj)
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return err
	}

	meta, err := MetaAccessor(obj)
	if err != nil {
		return err
	}
	meta.SetUpdatedBy(user.GetID().String())
	meta.SetUpdatedTimestamp(toPtr(time.Now()))

	// The creation user can not be changed
	oldmeta, err := MetaAccessor(oldObj)
	if err != nil {
		return err
	}
	meta.SetCreatedBy(oldmeta.GetCreatedBy())

	return s.verify(ctx, user, meta)
}

func toPtr[T any](v T) *T {
	return &v
}
