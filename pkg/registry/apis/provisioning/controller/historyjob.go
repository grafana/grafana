package controller

import (
	"context"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
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
	historyJobInformer informer.HistoricJobInformer,
	expirationTime time.Duration,
) (*HistoryJobController, error) {
	c := &HistoryJobController{
		client:         provisioningClient,
		logger:         logging.DefaultLogger.With("logger", historyJobControllerLoggerName),
		expirationTime: expirationTime,
	}

	// Use the resync events from the shared informer to trigger cleanup for each job
	_, err := historyJobInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			c.cleanupJob(obj)
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			c.cleanupJob(newObj)
		},
	})
	if err != nil {
		return nil, err
	}

	return c, nil
}

func (c *HistoryJobController) cleanupJob(obj interface{}) {
	job, ok := obj.(*provisioning.HistoricJob)
	if !ok {
		c.logger.Error("Expected HistoricJob but got", "type", obj)
		return
	}

	age := time.Since(job.CreationTimestamp.Time)
	if age > c.expirationTime {
		ctx := context.Background()
		err := c.client.HistoricJobs(job.Namespace).Delete(ctx, job.Name, metav1.DeleteOptions{})
		if err != nil && !apierrors.IsNotFound(err) {
			c.logger.Error("Failed to delete expired HistoryJob",
				"namespace", job.Namespace,
				"name", job.Name,
				"age", age,
				"error", err)
		} else {
			c.logger.Info("Deleted expired HistoryJob",
				"namespace", job.Namespace,
				"name", job.Name,
				"age", age)
		}
	}
}
