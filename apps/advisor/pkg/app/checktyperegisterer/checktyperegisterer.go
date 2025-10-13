package checktyperegisterer

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
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
}

// NewRunner creates a new Runner.
func New(cfg app.Config) (app.Runnable, error) {
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
	}, nil
}

func (r *Runner) Run(ctx context.Context) error {
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
			},
			Spec: advisorv0alpha1.CheckTypeSpec{
				Name:  t.ID(),
				Steps: stepTypes,
			},
		}
		id := obj.GetStaticMetadata().Identifier()
		_, err := r.client.Create(ctx, id, obj, resource.CreateOptions{})
		if err != nil {
			if errors.IsAlreadyExists(err) {
				// Already exists, update
				_, err = r.client.Update(ctx, id, obj, resource.UpdateOptions{})
				if err != nil {
					return err
				} else {
					continue
				}
			}
			return err
		}
	}
	return nil
}
