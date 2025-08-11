package checktyperegisterer

import (
	"context"
	"fmt"
	"maps"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checkregistry"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checks"
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

func (r *Runner) createOrUpdate(ctx context.Context, log logging.Logger, obj resource.Object) error {
	id := obj.GetStaticMetadata().Identifier()
	_, err := r.client.Create(ctx, id, obj, resource.CreateOptions{})
	if err != nil {
		if errors.IsAlreadyExists(err) {
			// Already exists, update
			log.Debug("Check type already exists, updating", "identifier", id)
			// Retrieve current annotations to avoid overriding them
			current, err := r.client.Get(ctx, obj.GetStaticMetadata().Identifier())
			if err != nil {
				return err
			}
			currentAnnotations := current.GetAnnotations()
			if currentAnnotations == nil {
				currentAnnotations = make(map[string]string)
			}
			annotations := obj.GetAnnotations()
			maps.Copy(currentAnnotations, annotations)
			obj.SetAnnotations(currentAnnotations) // This will update the annotations in the object
			_, err = r.client.Update(ctx, id, obj, resource.UpdateOptions{})
			if err != nil && !errors.IsAlreadyExists(err) {
				// Ignore the error, it's probably due to a race condition
				log.Info("Error updating check type, ignoring", "error", err)
			}
			return nil
		}
		return err
	}
	log.Debug("Check type registered successfully", "identifier", id)
	return nil
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
		for i := 0; i < r.retryAttempts; i++ {
			err := r.createOrUpdate(context.WithoutCancel(ctx), logger, obj)
			if err != nil {
				if strings.Contains(err.Error(), "apiserver is shutting down") {
					logger.Debug("Error creating check type, not retrying", "error", err)
					return nil
				}
				logger.Debug("Error creating check type, retrying", "error", err, "attempt", i+1)
				if i == r.retryAttempts-1 {
					logger.Error("Unable to register check type", "check_type", t.ID(), "error", err)
				} else {
					// Calculate exponential backoff delay: baseDelay * 2^attempt
					delay := r.retryDelay * time.Duration(1<<i)
					time.Sleep(delay)
				}
				continue
			}
			logger.Debug("Check type registered successfully", "check_type", t.ID())
			break
		}
	}
	return nil
}
