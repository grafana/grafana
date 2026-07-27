package controller

import (
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/logging"
)

const (
	jobControllerLoggerName = "provisioning-job-controller"
)

// JobController manages job create notifications.
type JobController struct {
	logger logging.Logger

	// notification channel for job create events (replaces InsertNotifications)
	notifications chan struct{}
}

// NewJobController creates a new JobController.
func NewJobController() *JobController {
	return &JobController{
		logger:        logging.DefaultLogger.With("logger", jobControllerLoggerName),
		notifications: make(chan struct{}, 1),
	}
}

// EventHandler returns the informer event handlers for the controller. Register
// it with the Jobs informer so job create events trigger notifications.
func (jc *JobController) EventHandler() cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			// Send notification for job create events (replaces InsertNotifications)
			jc.sendNotification()
		},
	}
}

// InsertNotifications returns a channel that receives notifications when jobs are created.
// This replaces the InsertNotifications method from persistentstore.go.
func (jc *JobController) InsertNotifications() chan struct{} {
	return jc.notifications
}

func (jc *JobController) sendNotification() {
	select {
	case jc.notifications <- struct{}{}:
	default:
		// Don't block if there's already a notification waiting
	}
}
