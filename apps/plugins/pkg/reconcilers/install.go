package reconcilers

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"k8s.io/apimachinery/pkg/api/errors"
)

// PluginInstallReconciler reconciles PluginInstall resources by ensuring
// that the declared plugins are installed and loaded on this Grafana instance.
// In HA environments with separate disks, each pod runs its own reconciler
// independently, managing its local plugin installation.
type PluginInstallReconciler struct {
	pluginInstaller PluginInstaller
	pluginRegistry  PluginRegistry
	installClient   *pluginsv0alpha1.PluginInstallClient

	nodeName       string // This pod's identifier
	grafanaVersion string
}

// ReconcilerConfig holds configuration for the PluginInstall reconciler
type ReconcilerConfig struct {
	PluginInstaller PluginInstaller
	PluginRegistry  PluginRegistry
	InstallClient   *pluginsv0alpha1.PluginInstallClient
	GrafanaVersion  string
	NodeName        string
}

// NewPluginInstallReconciler creates a new PluginInstall reconciler
func NewPluginInstallReconciler(cfg ReconcilerConfig) (operator.Reconciler, error) {
	nodeName := cfg.NodeName
	if nodeName == "" {
		nodeName = os.Getenv("HOSTNAME")
		if nodeName == "" {
			nodeName = "grafana-instance"
		}
	}

	reconciler := &PluginInstallReconciler{
		pluginInstaller: cfg.PluginInstaller,
		pluginRegistry:  cfg.PluginRegistry,
		installClient:   cfg.InstallClient,
		nodeName:        nodeName,
		grafanaVersion:  cfg.GrafanaVersion,
	}

	typedReconciler := &operator.TypedReconciler[*pluginsv0alpha1.PluginInstall]{
		ReconcileFunc: reconciler.reconcile,
	}

	return typedReconciler, nil
}

func (r *PluginInstallReconciler) reconcile(ctx context.Context, req operator.TypedReconcileRequest[*pluginsv0alpha1.PluginInstall]) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)
	pluginInstall := req.Object

	// Add timeout to prevent hanging operations
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	switch req.Action {
	case operator.ReconcileActionCreated, operator.ReconcileActionUpdated, operator.ReconcileActionResynced:
		return r.handleInstallOrUpdate(ctx, pluginInstall)
	case operator.ReconcileActionDeleted:
		return r.handleDelete(ctx, pluginInstall)
	default:
		logger.Info("Unknown action for PluginInstall", "action", req.Action)
		return operator.ReconcileResult{}, nil
	}
}

func (r *PluginInstallReconciler) handleInstallOrUpdate(ctx context.Context, pluginInstall *pluginsv0alpha1.PluginInstall) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	pluginID := pluginInstall.Spec.PluginID
	desiredVersion := pluginInstall.Spec.Version

	logger.Info("Reconciling plugin install",
		"pluginID", pluginID,
		"version", desiredVersion,
		"node", r.nodeName)

	localPlugin, localExists := r.pluginRegistry.Plugin(ctx, pluginID, "")

	needsAction := !localExists || (localExists && localPlugin.Version != desiredVersion)

	if !needsAction {
		logger.Info("Plugin already installed with correct version",
			"pluginID", pluginID,
			"version", localPlugin.Version)

		installedVersion := localPlugin.Version
		pluginClass := localPlugin.Class
		lastReconciled := time.Now().Format(time.RFC3339)
		return operator.ReconcileResult{}, r.updateNodeStatus(ctx, pluginInstall, pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus{
			NodeName:         r.nodeName,
			Phase:            "Ready",
			InstalledVersion: &installedVersion,
			PluginClass:      &pluginClass,
			LastReconciled:   &lastReconciled,
		})
	}

	lastReconciled := time.Now().Format(time.RFC3339)
	err := r.updateNodeStatus(ctx, pluginInstall, pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus{
		NodeName:       r.nodeName,
		Phase:          "Installing",
		LastReconciled: &lastReconciled,
	})
	if err != nil {
		logger.Warn("Failed to update status to Installing", "error", err)
	}

	sourceType := "catalog"
	if pluginInstall.Spec.Source != nil && pluginInstall.Spec.Source.Type != "" {
		sourceType = pluginInstall.Spec.Source.Type
	}

	var installErr error
	switch sourceType {
	case "catalog":
		installErr = r.installFromCatalog(ctx, pluginID, desiredVersion)
	case "cdn":
		installErr = r.installFromCDN(ctx, pluginInstall)
	case "url":
		installErr = r.installFromURL(ctx, pluginInstall)
	default:
		installErr = fmt.Errorf("unknown source type: %s", sourceType)
	}

	if installErr != nil {
		logger.Error("Failed to install plugin", "pluginID", pluginID, "error", installErr)

		message := installErr.Error()
		lastReconciled := time.Now().Format(time.RFC3339)
		statusErr := r.updateNodeStatus(ctx, pluginInstall, pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus{
			NodeName:       r.nodeName,
			Phase:          "Failed",
			Message:        &message,
			LastReconciled: &lastReconciled,
		})

		if statusErr != nil {
			logger.Warn("Failed to update status after installation failure", "error", statusErr)
		}

		return operator.ReconcileResult{}, installErr
	}

	verifiedPlugin, exists := r.pluginRegistry.Plugin(ctx, pluginID, "")
	if !exists {
		err := fmt.Errorf("plugin not found in registry after installation")
		logger.Error("Plugin verification failed", "pluginID", pluginID)

		message := err.Error()
		lastReconciled := time.Now().Format(time.RFC3339)
		r.updateNodeStatus(ctx, pluginInstall, pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus{
			NodeName:       r.nodeName,
			Phase:          "Failed",
			Message:        &message,
			LastReconciled: &lastReconciled,
		})

		return operator.ReconcileResult{}, err
	}

	logger.Info("Plugin installed successfully",
		"pluginID", pluginID,
		"version", verifiedPlugin.Version,
		"class", verifiedPlugin.Class)

	installedVersion2 := verifiedPlugin.Version
	pluginClass2 := verifiedPlugin.Class
	lastReconciled2 := time.Now().Format(time.RFC3339)
	return operator.ReconcileResult{}, r.updateNodeStatus(ctx, pluginInstall, pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus{
		NodeName:         r.nodeName,
		Phase:            "Ready",
		InstalledVersion: &installedVersion2,
		PluginClass:      &pluginClass2,
		LastReconciled:   &lastReconciled2,
	})
}

func (r *PluginInstallReconciler) handleDelete(ctx context.Context, pluginInstall *pluginsv0alpha1.PluginInstall) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)
	pluginID := pluginInstall.Spec.PluginID
	logger.Info("Handling plugin deletion", "pluginID", pluginID, "node", r.nodeName)

	localPlugin, exists := r.pluginRegistry.Plugin(ctx, pluginID, "")
	if !exists {
		logger.Info("Plugin not found locally, nothing to delete", "pluginID", pluginID)
		return operator.ReconcileResult{}, nil
	}

	err := r.pluginInstaller.Remove(ctx, pluginID, localPlugin.Version)
	if err != nil {
		logger.Error("Failed to remove plugin", "pluginID", pluginID, "error", err)
		requeueAfter := 30 * time.Second
		return operator.ReconcileResult{RequeueAfter: &requeueAfter}, err
	}

	logger.Info("Plugin removed successfully", "pluginID", pluginID)
	return operator.ReconcileResult{}, nil
}

// installFromCatalog downloads and installs a plugin from the Grafana plugin catalog
func (r *PluginInstallReconciler) installFromCatalog(ctx context.Context, pluginID, version string) error {
	opts := NewAddOpts(r.grafanaVersion, runtime.GOOS, runtime.GOARCH, "")
	return r.pluginInstaller.Add(ctx, pluginID, version, opts)
}

// installFromCDN loads a plugin from a CDN (no download needed)
func (r *PluginInstallReconciler) installFromCDN(_ context.Context, pluginInstall *pluginsv0alpha1.PluginInstall) error {
	if pluginInstall.Spec.Source == nil || pluginInstall.Spec.Source.CdnOptions == nil {
		return fmt.Errorf("CDN source specified but cdnOptions not provided")
	}

	// For CDN plugins, we create a CDN source and load it
	// Note: This would require implementing a CDNSource if not already available
	// For now, return an error indicating this needs implementation
	return fmt.Errorf("CDN plugin loading not yet implemented - requires CDNSource")
}

// installFromURL downloads and installs a plugin from an arbitrary URL
func (r *PluginInstallReconciler) installFromURL(ctx context.Context, pluginInstall *pluginsv0alpha1.PluginInstall) error {
	if pluginInstall.Spec.Source == nil || pluginInstall.Spec.Source.UrlOptions == nil {
		return fmt.Errorf("URL source specified but urlOptions not provided")
	}

	url := pluginInstall.Spec.Source.UrlOptions.Url
	opts := NewAddOpts(r.grafanaVersion, runtime.GOOS, runtime.GOARCH, url)

	return r.pluginInstaller.Add(ctx, pluginInstall.Spec.PluginID, pluginInstall.Spec.Version, opts)
}

// updateNodeStatus updates this node's status in the PluginInstall resource
func (r *PluginInstallReconciler) updateNodeStatus(ctx context.Context, pluginInstall *pluginsv0alpha1.PluginInstall, nodeStatus pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus) error {
	logger := logging.FromContext(ctx)

	// Get the latest version to avoid conflicts
	identifier := resource.Identifier{
		Namespace: pluginInstall.Namespace,
		Name:      pluginInstall.Name,
	}

	current, err := r.installClient.Get(ctx, identifier)
	if err != nil {
		return fmt.Errorf("failed to get current PluginInstall: %w", err)
	}

	// Initialize maps if needed
	if current.Status.NodeStatus == nil {
		current.Status.NodeStatus = make(map[string]pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus)
	}

	// Update this node's status
	current.Status.NodeStatus[r.nodeName] = nodeStatus

	// Recalculate aggregate status
	r.calculateAggregateStatus(current)

	// Update status using the UpdateStatus method
	maxRetries := 3
	for i := range maxRetries {
		current, err = r.installClient.UpdateStatus(ctx, identifier, current.Status, resource.UpdateOptions{
			ResourceVersion: current.ResourceVersion,
		})

		if err == nil {
			return nil
		}

		// If conflict, retry with latest version
		if errors.IsConflict(err) {
			logger.Debug("Status update conflict, retrying", "attempt", i+1)

			current, err = r.installClient.Get(ctx, identifier)
			if err != nil {
				return fmt.Errorf("failed to get PluginInstall for retry: %w", err)
			}

			if current.Status.NodeStatus == nil {
				current.Status.NodeStatus = make(map[string]pluginsv0alpha1.PluginInstallV0alpha1StatusNodeStatus)
			}
			current.Status.NodeStatus[r.nodeName] = nodeStatus
			r.calculateAggregateStatus(current)

			continue
		}

		return fmt.Errorf("failed to update status: %w", err)
	}

	logger.Warn("Failed to update status after retries", "retries", maxRetries)
	return nil // Don't fail reconciliation on status update errors
}

// calculateAggregateStatus calculates the overall status from individual node statuses
func (r *PluginInstallReconciler) calculateAggregateStatus(pluginInstall *pluginsv0alpha1.PluginInstall) {
	ready := int64(0)
	installing := int64(0)
	failed := int64(0)

	for _, status := range pluginInstall.Status.NodeStatus {
		switch status.Phase {
		case "Ready":
			ready++
		case "Installing":
			installing++
		case "Failed":
			failed++
		}
	}

	pluginInstall.Status.ReadyNodes = &ready
	pluginInstall.Status.InstallingNodes = &installing
	pluginInstall.Status.FailedNodes = &failed
	total := int64(len(pluginInstall.Status.NodeStatus))
	pluginInstall.Status.TotalNodes = &total

	// Determine overall phase
	if ready == total && total > 0 {
		phase := "Ready"
		pluginInstall.Status.Phase = &phase
		msg := fmt.Sprintf("Plugin installed on all %d nodes", total)
		pluginInstall.Status.Message = &msg
	} else if installing > 0 {
		phase := "Installing"
		pluginInstall.Status.Phase = &phase
		msg := fmt.Sprintf("Installing on %d/%d nodes", installing, total)
		pluginInstall.Status.Message = &msg
	} else if failed > 0 && ready > 0 {
		phase := "PartiallyFailed"
		pluginInstall.Status.Phase = &phase
		msg := fmt.Sprintf("Failed on %d nodes, ready on %d nodes", failed, ready)
		pluginInstall.Status.Message = &msg
	} else if failed > 0 {
		phase := "Failed"
		pluginInstall.Status.Phase = &phase
		msg := fmt.Sprintf("Failed on %d/%d nodes", failed, total)
		pluginInstall.Status.Message = &msg
	} else {
		phase := "Pending"
		pluginInstall.Status.Phase = &phase
		msg := "Waiting for nodes to reconcile"
		pluginInstall.Status.Message = &msg
	}
}
