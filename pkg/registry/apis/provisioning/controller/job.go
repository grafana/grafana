package controller

import (
	"context"

	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-app-sdk/logging"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
)

const (
	jobControllerLoggerName = "provisioning-job-controller"
)

// JobController manages job create notifications.
type JobController struct {
	jobSynced cache.InformerSynced
	logger    logging.Logger

	// notification channel for job create events (replaces InsertNotifications)
	notifications chan struct{}
}

// NewJobController creates a new JobController.
func NewJobController(
	jobInformer informer.JobInformer,
) (*JobController, error) {
	jc := &JobController{
		jobSynced:     jobInformer.Informer().HasSynced,
		logger:        logging.DefaultLogger.With("logger", jobControllerLoggerName),
		notifications: make(chan struct{}, 1),
	}

	_, err := jobInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			// Send notification for job create events (replaces InsertNotifications)
			jc.sendNotification()
		},
	})
	if err != nil {
		return nil, err
	}

	return jc, nil
}

// Run starts the JobController.
func (jc *JobController) Run(ctx context.Context) {
	logger := jc.logger
	ctx = logging.Context(ctx, logger)
	logger.Info("Starting JobController")
	defer logger.Info("Shutting down JobController")

	if !cache.WaitForCacheSync(ctx.Done(), jc.jobSynced) {
		return
	}

	logger.Info("JobController started")
	<-ctx.Done()
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

