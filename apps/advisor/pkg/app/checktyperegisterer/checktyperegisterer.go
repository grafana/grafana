package checktyperegisterer

import (
	"context"
	"fmt"
	"maps"
	"strings"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Runner is a "runnable" app used to be able to expose and API endpoint
// with the existing checks types. This does not need to be a CRUD resource, but it is
// the only way existing at the moment to expose the check types.
type Runner struct {
	checkRegistry checkregistry.CheckService
	client        resource.Client
	namespace     string
	log           logging.Logger
	retryAttempts int
	retryDelay    time.Duration
}

// NewRunner creates a new Runner.
func New(cfg app.Config, log logging.Logger) (app.Runnable, error) {
	// Read config
	specificConfig, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}
	checkRegistry := specificConfig.CheckRegistry
	namespace, err := checks.GetNamespace(specificConfig.StackID)
	if err != nil {
		return nil, err
	}

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckTypeKind())
	if err != nil {
		return nil, err
	}

	return &Runner{
		checkRegistry: checkRegistry,
		client:        client,
		namespace:     namespace,
		log:           log.With("runner", "advisor.checktyperegisterer"),
		retryAttempts: 5,
		retryDelay:    time.Second * 10,
	}, nil
}

func (r *Runner) Run(ctx context.Context) error {
	logger := r.log.WithContext(ctx)
	for _, t := range r.checkRegistry.Checks() {
		steps := t.Steps()
		stepTypes := make([]advisorv0alpha1.CheckTypeStep, len(steps))
		for i, s := range steps {
			stepTypes[i] = advisorv0alpha1.CheckTypeStep{
				Title:       s.Title(),
				Description: s.Description(),
				StepID:      s.ID(),
				Resolution:  s.Resolution(),
			}
		}
		obj := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name:      t.ID(),
				Namespace: r.namespace,
				Annotations: map[string]string{
					checks.NameAnnotation: t.Name(),
					// Flag to indicate feature availability
					checks.RetryAnnotation:       "1",
					checks.IgnoreStepsAnnotation: "1",
				},
			},
			Spec: advisorv0alpha1.CheckTypeSpec{
				Name:  t.ID(),
				Steps: stepTypes,
			},
		}
		err := r.registerCheckType(ctx, logger, t.ID(), obj)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Runner) registerCheckType(ctx context.Context, logger logging.Logger, checkType string, obj resource.Object) error {
	for i := 0; i < r.retryAttempts; i++ {
		current, err := r.client.Get(ctx, obj.GetStaticMetadata().Identifier())
		if err != nil {
			if errors.IsNotFound(err) {
				// Check type does not exist, create it
				err = r.create(context.WithoutCancel(ctx), logger, obj)
				if err != nil {
					if !r.shouldRetry(err, logger, i+1, checkType) {
						return nil
					}
					// Retry
					continue
				}
				// Success
				logger.Debug("Check type created successfully", "check_type", checkType)
				break
			}
			if !r.shouldRetry(err, logger, i+1, checkType) {
				return nil
			}
			// Retry
			continue
		}

		// Check type already exists, check if it's the same and update if needed
		logger.Debug("Check type already exists, checking if it's the same", "identifier", obj.GetStaticMetadata().Identifier())
		if r.needsUpdate(current, obj, logger) {
			err = r.update(context.WithoutCancel(ctx), logger, obj, current)
			if err != nil {
				if !r.shouldRetry(err, logger, i+1, checkType) {
					return nil
				}
				// Retry
				continue
			}
			// Success
			logger.Debug("Check type updated successfully", "check_type", checkType)
			break
		}

		// Check type is the same, no need to update
		logger.Debug("Check type already registered", "check_type", checkType)
		break
	}
	return nil
}

func (r *Runner) shouldRetry(err error, logger logging.Logger, attempt int, checkType string) bool {
	logger.Debug("Error storing check type", "error", err, "attempt", attempt)
	if isAPIServerShuttingDown(err, logger) {
		return false
	}
	if attempt == r.retryAttempts-1 {
		logger.Error("Unable to register check type", "check_type", checkType, "error", err)
		return false
	}
	// Calculate exponential backoff delay: baseDelay * 2^attempt
	delay := r.retryDelay * time.Duration(1<<attempt)
	time.Sleep(delay)
	return true
}

func (r *Runner) create(ctx context.Context, log logging.Logger, obj resource.Object) error {
	id := obj.GetStaticMetadata().Identifier()
	_, err := r.client.Create(ctx, id, obj, resource.CreateOptions{})
	if err != nil {
		return err
	}
	log.Debug("Check type created successfully", "identifier", id)
	return nil
}

func (r *Runner) needsUpdate(current, newObj resource.Object, log logging.Logger) bool {
	needsUpdate := false
	// Check if the object annotations exist in the current object
	currentAnnotations := current.GetAnnotations()
	if currentAnnotations == nil {
		currentAnnotations = make(map[string]string)
	}
	annotations := newObj.GetAnnotations()
	for k, v := range annotations {
		if currentAnnotations[k] != v {
			needsUpdate = true
		}
	}
	// Compare checktype spec steps with current steps
	currentCheckType := current.(*advisorv0alpha1.CheckType)
	newCheckType := newObj.(*advisorv0alpha1.CheckType)
	newSteps := newCheckType.Spec.Steps
	currentSteps := currentCheckType.Spec.Steps
	if !cmp.Equal(newSteps, currentSteps, cmpopts.SortSlices(func(a, b advisorv0alpha1.CheckTypeStep) bool {
		return a.StepID < b.StepID
	})) {
		log.Debug("Check type step mismatch, updating", "identifier", newObj.GetStaticMetadata().Identifier())
		needsUpdate = true
	}
	return needsUpdate
}

func (r *Runner) update(ctx context.Context, log logging.Logger, obj resource.Object, current resource.Object) error {
	id := obj.GetStaticMetadata().Identifier()
	log.Debug("Updating check type", "identifier", id)

	currentAnnotations := current.GetAnnotations()
	if currentAnnotations == nil {
		currentAnnotations = make(map[string]string)
	}
	annotations := obj.GetAnnotations()
	maps.Copy(currentAnnotations, annotations)
	obj.SetAnnotations(currentAnnotations) // This will update the annotations in the object

	_, err := r.client.Update(ctx, id, obj, resource.UpdateOptions{})
	if err != nil && !errors.IsAlreadyExists(err) {
		// Ignore the error, it's probably due to a race condition
		log.Info("Error updating check type, ignoring", "error", err)
	}
	log.Debug("Check type updated successfully", "identifier", id)
	return nil
}

func isAPIServerShuttingDown(err error, logger logging.Logger) bool {
	if strings.Contains(err.Error(), "apiserver is shutting down") {
		logger.Debug("Error creating check type, not retrying", "error", err)
		return true
	}
	return false
}
