package controller

import (
	"context"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	historyJobControllerLoggerName = "provisioning-historyjob-controller"
)

// HistoryJobController manages the cleanup of old HistoryJob entries.
type HistoryJobController struct {
	client         client.ProvisioningV0alpha1Interface
	logger         logging.Logger
	expirationTime time.Duration
}

// NewHistoryJobController creates a new HistoryJobController.
func NewHistoryJobController(
	provisioningClient client.ProvisioningV0alpha1Interface,
	expirationTime time.Duration,
) *HistoryJobController {
	return &HistoryJobController{
		client:         provisioningClient,
		logger:         logging.DefaultLogger.With("logger", historyJobControllerLoggerName),
		expirationTime: expirationTime,
	}
}

// EventHandler returns the informer event handlers for the controller. Register
// it with the HistoricJobs informer so resync events trigger cleanup of expired jobs.
func (c *HistoryJobController) EventHandler() cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			c.cleanupJob(obj)
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			c.cleanupJob(newObj)
		},
	}
}

func (c *HistoryJobController) cleanupJob(obj interface{}) {
	job, ok := obj.(*provisioning.HistoricJob)
	if !ok {
		c.logger.Error("unexpected object type - expected HistoricJob", "type", obj)
		return
	}

	age := time.Since(job.CreationTimestamp.Time)

	// Only cleanup jobs older than expiration time
	if age <= c.expirationTime {
		return
	}

	logger := c.logger.With(
		"job", job.Name,
		"namespace", job.Namespace,
		"age", age,
	)

	logger.Debug("start cleanup expired historic job")

	namespace := job.Namespace
	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), namespace)
	if err != nil {
		logger.Error("failed to set provisioning identity", "error", err)
		return
	}

	ctx = request.WithNamespace(ctx, namespace)
	err = c.client.HistoricJobs(job.Namespace).Delete(ctx, job.Name, metav1.DeleteOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			logger.Debug("historic job already deleted")
			return
		}
		logger.Error("failed to delete expired historic job", "error", err)
		return
	}

	logger.Info("deleted expired historic job")
}
