package watchers

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/klog/v2"

	investigation "github.com/grafana/grafana/apps/investigation/pkg/apis/investigation/v1alpha1"
)

var _ operator.ResourceWatcher = &InvestigationWatcher{}

type InvestigationWatcher struct{}

func NewInvestigationWatcher() (*InvestigationWatcher, error) {
	return &InvestigationWatcher{}, nil
}

// Add handles add events for investigation.Investigation resources.
func (s *InvestigationWatcher) Add(ctx context.Context, rObj resource.Object) error {
	object, ok := rObj.(*investigation.Investigation)
	if !ok {
		return fmt.Errorf("provided object is not of type *investigation.Investigation (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	klog.InfoS("Added resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

// Update handles update events for investigation.Investigation resources.
func (s *InvestigationWatcher) Update(ctx context.Context, rOld resource.Object, rNew resource.Object) error {
	oldObject, ok := rOld.(*investigation.Investigation)
	if !ok {
		return fmt.Errorf("provided object is not of type *investigation.Investigation (name=%s, namespace=%s, kind=%s)",
			rOld.GetStaticMetadata().Name, rOld.GetStaticMetadata().Namespace, rOld.GetStaticMetadata().Kind)
	}

	_, ok = rNew.(*investigation.Investigation)
	if !ok {
		return fmt.Errorf("provided object is not of type *investigation.Investigation (name=%s, namespace=%s, kind=%s)",
			rNew.GetStaticMetadata().Name, rNew.GetStaticMetadata().Namespace, rNew.GetStaticMetadata().Kind)
	}

	klog.InfoS("Updated resource", "name", oldObject.GetStaticMetadata().Identifier().Name)
	return nil
}

// Delete handles delete events for investigation.Investigation resources.
func (s *InvestigationWatcher) Delete(ctx context.Context, rObj resource.Object) error {
	object, ok := rObj.(*investigation.Investigation)
	if !ok {
		return fmt.Errorf("provided object is not of type *investigation.Investigation (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	klog.InfoS("Deleted resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

// Sync is not a standard resource.Watcher function, but is used when wrapping this watcher in an operator.OpinionatedWatcher.
// It handles resources which MAY have been updated during an outage period where the watcher was not able to consume events.
func (s *InvestigationWatcher) Sync(ctx context.Context, rObj resource.Object) error {
	object, ok := rObj.(*investigation.Investigation)
	if !ok {
		return fmt.Errorf("provided object is not of type *investigation.Investigation (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	klog.InfoS("Possible resource update", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}
