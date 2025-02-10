package checkscheduler

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/klog/v2"
)

const evaluateChecksInterval = 24 * time.Hour

// Runner is a "runnable" app used to be able to expose and API endpoint
// with the existing checks types. This does not need to be a CRUD resource, but it is
// the only way existing at the moment to expose the check types.
type Runner struct {
	checkRegistry checkregistry.CheckService
	client        resource.Client
}

// NewRunner creates a new Runner.
func New(cfg app.Config) (app.Runnable, error) {
	// Read config
	checkRegistry, ok := cfg.SpecificConfig.(checkregistry.CheckService)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}

	return &Runner{
		checkRegistry: checkRegistry,
		client:        client,
	}, nil
}

func (r *Runner) Run(ctx context.Context) error {
	lastCreated, err := r.checkLastCreated(ctx)
	if err != nil {
		return err
	}

	// do an initial creation if necessary
	if lastCreated.IsZero() {
		err = r.createChecks(ctx)
		if err != nil {
			klog.Error("Error creating new check reports", "error", err)
		} else {
			lastCreated = time.Now()
		}
	}

	nextSendInterval := time.Until(lastCreated.Add(evaluateChecksInterval))
	if nextSendInterval < time.Minute {
		nextSendInterval = 1 * time.Minute
	}

	ticker := time.NewTicker(nextSendInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			err = r.createChecks(ctx)
			if err != nil {
				klog.Error("Error creating new check reports", "error", err)
			}

			if nextSendInterval != evaluateChecksInterval {
				nextSendInterval = evaluateChecksInterval
			}
			ticker.Reset(nextSendInterval)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// checkLastCreated returns the creation time of the last check created
// regardless of its ID. This assumes that the checks are created in batches
// so a batch will have a similar creation time.
func (r *Runner) checkLastCreated(ctx context.Context) (time.Time, error) {
	list, err := r.client.List(ctx, metav1.NamespaceDefault, resource.ListOptions{})
	if err != nil {
		return time.Time{}, err
	}
	lastCreated := time.Time{}
	for _, item := range list.GetItems() {
		itemCreated := item.GetCreationTimestamp().Time
		if itemCreated.After(lastCreated) {
			lastCreated = itemCreated
		}
	}
	return lastCreated, nil
}

// createChecks creates a new check for each check type in the registry.
func (r *Runner) createChecks(ctx context.Context) error {
	for _, check := range r.checkRegistry.Checks() {
		obj := &advisorv0alpha1.Check{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "check-",
				Namespace:    metav1.NamespaceDefault,
				Labels: map[string]string{
					checks.TypeLabel: check.ID(),
				},
			},
			Spec: advisorv0alpha1.CheckSpec{},
		}
		id := obj.GetStaticMetadata().Identifier()
		_, err := r.client.Create(ctx, id, obj, resource.CreateOptions{})
		if err != nil {
			return fmt.Errorf("error creating check: %w", err)
		}
	}
	return nil
}
