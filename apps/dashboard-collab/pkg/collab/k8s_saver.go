package collab

import (
	"context"
	"fmt"
	"log/slog"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

const (
	// AnnoKeyVersionType is the annotation key for dashboard version type.
	AnnoKeyVersionType = "grafana.app/versionType"
)

// K8sDashboardSaver implements DashboardSaver by writing to the k8s dashboard API.
// It uses the session's resourceVersion for optimistic concurrency control.
type K8sDashboardSaver struct {
	client   dynamic.Interface
	gvr      schema.GroupVersionResource
	sessions *SessionManager
	logger   *slog.Logger
}

// K8sDashboardSaverConfig configures a K8sDashboardSaver.
type K8sDashboardSaverConfig struct {
	Client   dynamic.Interface
	GVR      schema.GroupVersionResource
	Sessions *SessionManager
	Logger   *slog.Logger
}

// NewK8sDashboardSaver creates a new K8sDashboardSaver.
func NewK8sDashboardSaver(cfg K8sDashboardSaverConfig) *K8sDashboardSaver {
	if cfg.Logger == nil {
		cfg.Logger = slog.Default()
	}
	return &K8sDashboardSaver{
		client:   cfg.Client,
		gvr:      cfg.GVR,
		sessions: cfg.Sessions,
		logger:   cfg.Logger,
	}
}

// Save persists the current dashboard state to unified storage via the k8s API.
// It fetches the current resource, sets the version_type annotation, and updates it.
// On version conflict (409): returns error so the autosave worker skips and retries next cycle.
func (s *K8sDashboardSaver) Save(ctx context.Context, namespace, uid string, versionType string) error {
	res := s.client.Resource(s.gvr).Namespace(namespace)

	// Get the current dashboard resource.
	obj, err := res.Get(ctx, uid, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("get dashboard %s/%s: %w", namespace, uid, err)
	}

	// Check session resourceVersion for optimistic concurrency.
	session := s.sessions.GetOrCreate(namespace, uid)
	sessionRV := session.GetResourceVersion()
	currentRV := obj.GetResourceVersion()

	// If the session has a stale resourceVersion, someone else modified the resource.
	// Skip this cycle — the next autosave tick will fetch the latest state.
	if sessionRV != "" && sessionRV != currentRV {
		return fmt.Errorf("resource version mismatch: session has %s, current is %s", sessionRV, currentRV)
	}

	// Set the version_type annotation on the resource.
	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	annotations[AnnoKeyVersionType] = versionType
	obj.SetAnnotations(annotations)

	// Update the dashboard resource.
	updated, err := res.Update(ctx, obj, metav1.UpdateOptions{})
	if err != nil {
		if apierrors.IsConflict(err) {
			// Version conflict: skip this cycle, retry next time.
			s.logger.Warn("autosave version conflict, will retry next cycle",
				"namespace", namespace,
				"uid", uid,
			)
			return fmt.Errorf("version conflict for %s/%s: %w", namespace, uid, err)
		}
		return fmt.Errorf("update dashboard %s/%s: %w", namespace, uid, err)
	}

	// Update the session's resourceVersion after successful save.
	session.SetResourceVersion(updated.GetResourceVersion())

	s.logger.Info("autosave completed",
		"namespace", namespace,
		"uid", uid,
		"versionType", versionType,
		"resourceVersion", updated.GetResourceVersion(),
	)

	return nil
}
