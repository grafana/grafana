package checktyperegisterer

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Runner is a "runnable" app used to be able to expose and API endpoint
// with the existing checks types. This does not need to be a CRUD resource, but it is
// the only way existing at the moment to expose the check types.
type Runner struct {
	checkMap    map[string]checks.Check
	typesClient resource.Client
}

// NewRunner creates a new Runner.
func NewRunner(checkMap map[string]checks.Check, typesClient resource.Client) *Runner {
	return &Runner{
		checkMap:    checkMap,
		typesClient: typesClient,
	}
}

func (r *Runner) Run(ctx context.Context) error {
	for _, t := range r.checkMap {
		steps := t.Steps()
		stepTypes := make([]advisorv0alpha1.CheckTypeStep, len(steps))
		for i, s := range steps {
			stepTypes[i] = advisorv0alpha1.CheckTypeStep{
				Title:       s.Title(),
				Description: s.Description(),
				StepID:      s.ID(),
			}
		}
		obj := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name:      t.ID(),
				Namespace: metav1.NamespaceDefault,
			},
			Spec: advisorv0alpha1.CheckTypeSpec{
				Name:  t.ID(),
				Steps: stepTypes,
			},
		}
		id := obj.GetStaticMetadata().Identifier()
		_, err := r.typesClient.Create(ctx, id, obj, resource.CreateOptions{})
		if err != nil {
			if errors.IsAlreadyExists(err) {
				// Already exists, update
				_, err = r.typesClient.Update(ctx, id, obj, resource.UpdateOptions{})
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
