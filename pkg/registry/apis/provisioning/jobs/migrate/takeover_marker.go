package migrate

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/util/retry"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// FolderTakeoverMarker marks folders that a branch migration exported with
// their original UID, so that the first sync after the merge takes them over.
type FolderTakeoverMarker interface {
	MarkPendingTakeover(ctx context.Context, namespace, repoName string, folderUIDs []string) error
}

type folderTakeoverMarker struct {
	clients resources.ClientFactory
}

// NewFolderTakeoverMarker returns a FolderTakeoverMarker that writes
// resources.AnnoKeyPendingTakeover on each folder.
func NewFolderTakeoverMarker(clients resources.ClientFactory) FolderTakeoverMarker {
	return &folderTakeoverMarker{clients: clients}
}

func (m *folderTakeoverMarker) MarkPendingTakeover(ctx context.Context, namespace, repoName string, folderUIDs []string) error {
	clients, err := m.clients.Clients(ctx, namespace)
	if err != nil {
		return fmt.Errorf("get clients: %w", err)
	}
	folderClient, _, err := clients.Folder(ctx)
	if err != nil {
		return fmt.Errorf("get folder client: %w", err)
	}
	ctx, _, err = identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return fmt.Errorf("use provisioning identity: %w", err)
	}

	logger := logging.FromContext(ctx)
	for _, uid := range folderUIDs {
		err := retry.RetryOnConflict(retry.DefaultRetry, func() error {
			obj, err := folderClient.Get(ctx, uid, metav1.GetOptions{})
			if err != nil {
				return err
			}
			meta, err := utils.MetaAccessor(obj)
			if err != nil {
				return fmt.Errorf("create meta accessor: %w", err)
			}
			// A folder that is already managed cannot be taken over after the merge.
			if _, managed := meta.GetManagerProperties(); managed {
				logger.Info("not marking folder for takeover: it is already managed", "folder", uid)
				return nil
			}
			annotations := obj.GetAnnotations()
			if annotations == nil {
				annotations = make(map[string]string)
			}
			if annotations[resources.AnnoKeyPendingTakeover] == repoName {
				return nil
			}
			annotations[resources.AnnoKeyPendingTakeover] = repoName
			obj.SetAnnotations(annotations)
			_, err = folderClient.Update(ctx, obj, metav1.UpdateOptions{})
			return err
		})
		if apierrors.IsNotFound(err) {
			logger.Info("not marking folder for takeover: it no longer exists", "folder", uid)
			continue
		}
		if err != nil {
			return fmt.Errorf("mark folder %q: %w", uid, err)
		}
	}
	return nil
}
