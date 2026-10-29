package folder

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-app-sdk/logging"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// logIfTerminating re-fetches the folder behind a notification and logs it when it is terminating.
func logIfTerminating(ctx context.Context, logger logging.Logger, client rest.Interface, obj any) {
	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		logger.Error("folder event: failed to read object", "error", err)
		return
	}
	ns, name := accessor.GetNamespace(), accessor.GetName()

	if terminating, err := isTerminating(ctx, client, ns, name); err != nil {
		// A folder that is already gone has nothing left to do.
		logger.Debug("folder event: re-fetch failed", "namespace", ns, "name", name, "error", err)
	} else if terminating {
		logger.Info("folder terminating", "namespace", ns, "name", name)
	}
}

func isTerminating(ctx context.Context, client rest.Interface, ns, name string) (bool, error) {
	raw, err := client.Get().
		AbsPath("/apis", folderGVR.Group, folderGVR.Version, "namespaces", ns, folderGVR.Resource, name).
		DoRaw(ctx)
	if err != nil {
		return false, err
	}
	var folder metav1.PartialObjectMetadata
	if err := json.Unmarshal(raw, &folder); err != nil {
		return false, err
	}
	return folder.DeletionTimestamp != nil && len(folder.Finalizers) > 0, nil
}
