package folders

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// cascadeDeleteRequesterOf returns the status record for user and service-account requesters, and nil
// for any other identity type.
func cascadeDeleteRequesterOf(user identity.Requester) *foldersv1.FolderCascadeDeleteRequester {
	if !user.IsIdentityType(authlib.TypeUser, authlib.TypeServiceAccount) {
		return nil
	}
	return &foldersv1.FolderCascadeDeleteRequester{
		Sub:        user.GetSubject(),
		Identifier: user.GetIdentifier(),
		Type:       foldersv1.FolderCascadeDeleteRequesterType(user.GetIdentityType()),
	}
}

// recordCascadeDeleteRequester writes the requester (nil clears it) through the status subresource,
// pinned to f's version. ctx must carry the service identity.
func (s *cascadeDeleteStorage) recordCascadeDeleteRequester(ctx context.Context, f *foldersv1.Folder, requester *foldersv1.FolderCascadeDeleteRequester) (*foldersv1.Folder, error) {
	res, err := s.updateCascadeDeleteRequester(ctx, f, func(obj *foldersv1.Folder) {
		if obj.Status.CascadeDelete == nil {
			obj.Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{}
		}
		obj.Status.CascadeDelete.Requester = requester
	})
	if err != nil {
		return nil, err
	}
	stamped, ok := res.(*foldersv1.Folder)
	if !ok {
		return nil, fmt.Errorf("unexpected status update result %T", res)
	}
	return stamped, nil
}

// clearCascadeDeleteRequester undoes a stamp after a failed delete.
func (s *cascadeDeleteStorage) clearCascadeDeleteRequester(ctx context.Context, stamped *foldersv1.Folder, requester *foldersv1.FolderCascadeDeleteRequester) error {
	_, err := s.updateCascadeDeleteRequester(ctx, stamped, func(obj *foldersv1.Folder) {
		if obj.Status.CascadeDelete != nil && obj.Status.CascadeDelete.Requester != nil && *obj.Status.CascadeDelete.Requester == *requester {
			obj.Status.CascadeDelete.Requester = nil
		}
	})
	return err
}

func (s *cascadeDeleteStorage) updateCascadeDeleteRequester(ctx context.Context, f *foldersv1.Folder, mutate func(*foldersv1.Folder)) (runtime.Object, error) {
	objInfo := rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, _, oldObj runtime.Object) (runtime.Object, error) {
		cur, ok := oldObj.(*foldersv1.Folder)
		if !ok || cur.UID != f.UID || cur.ResourceVersion != f.ResourceVersion {
			return nil, apierrors.NewConflict(foldersv1.FolderResourceInfo.GroupResource(), f.Name, errors.New("the folder changed"))
		}
		obj := cur.DeepCopy()
		mutate(obj)
		return obj, nil
	})
	res, _, err := s.status.Update(ctx, f.Name, objInfo, nil, nil, false, &metav1.UpdateOptions{})
	return res, err
}
