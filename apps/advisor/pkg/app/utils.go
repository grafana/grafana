package app

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/contexthandler"
)

func getCheck(obj resource.Object, checkMap map[string]checks.Check) (checks.Check, error) {
	labels := obj.GetLabels()
	objTypeLabel, ok := labels[checks.TypeLabel]
	if !ok {
		return nil, errors.New("missing check type as label")
	}
	c, ok := checkMap[objTypeLabel]
	if !ok {
		supportedTypes := ""
		for k := range checkMap {
			supportedTypes += k + ", "
		}
		return nil, fmt.Errorf("unknown check type %s. Supported types are: %s", objTypeLabel, supportedTypes)
	}

	return c, nil
}

func processCheck(ctx context.Context, log logging.Logger, client resource.Client, typesClient resource.Client, obj resource.Object, check checks.Check) error {
	status := checks.GetStatusAnnotation(obj)
	if status != "" {
		// Check already processed
		return nil
	}
	c, ok := obj.(*advisorv0alpha1.Check)
	if !ok {
		return fmt.Errorf("invalid object type")
	}
	// Get the items to check
	err := check.Init(ctx)
	if err != nil {
		return fmt.Errorf("error initializing check: %w", err)
	}
	items, err := check.Items(ctx)
	if err != nil {
		setErr := checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationError)
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error listing items for check: %w", err)
	}
	// Get the check type
	var checkType resource.Object
	checkType, err = typesClient.Get(ctx, resource.Identifier{
		Namespace: obj.GetNamespace(),
		Name:      check.ID(),
	})
	if err != nil {
		return err
	}
	// Run the steps
	steps, err := filterSteps(checkType, check.Steps())
	if err != nil {
		return err
	}
	failures, err := runStepsInParallel(ctx, log, &c.Spec, steps, items)
	if err != nil {
		setErr := checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationError)
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error running steps: %w", err)
	}

	report := &advisorv0alpha1.CheckReport{
		Failures: failures,
		Count:    int64(len(items)),
	}
	c.Status.Report = *report
	err = checks.SetStatus(ctx, client, obj, c.Status)
	if err != nil {
		return err
	}
	// Set the status annotation to processed and annotate the steps ignored
	annotations := checks.AddAnnotations(ctx, obj, map[string]string{
		checks.StatusAnnotation:          checks.StatusAnnotationProcessed,
		checks.IgnoreStepsAnnotationList: checkType.GetAnnotations()[checks.IgnoreStepsAnnotationList],
	})
	return checks.SetAnnotations(ctx, client, obj, annotations)
}

func processCheckRetry(ctx context.Context, log logging.Logger, client resource.Client, typesClient resource.Client, obj resource.Object, check checks.Check) error {
	status := checks.GetStatusAnnotation(obj)
	if status == "" || status == checks.StatusAnnotationError {
		// Check not processed yet or errored
		log.Debug("Check not processed yet or errored, skipping retry", "check", obj.GetName(), "status", status)
		return nil
	}
	// Get the item to retry from the annotation
	itemToRetry := checks.GetRetryAnnotation(obj)
	if itemToRetry == "" {
		// No item to retry, nothing to do
		log.Debug("No item to retry, skipping retry", "check", obj.GetName())
		return nil
	} else {
		log.Debug("Item to retry found", "check", obj.GetName(), "item", itemToRetry)
	}
	c, ok := obj.(*advisorv0alpha1.Check)
	if !ok {
		return fmt.Errorf("invalid object type")
	}
	// Get the items to check
	err := check.Init(ctx)
	if err != nil {
		return fmt.Errorf("error initializing check: %w", err)
	}
	failures := []advisorv0alpha1.CheckReportFailure{}
	item, err := check.Item(ctx, itemToRetry)
	if err != nil {
		setErr := checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationError)
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error getting item for check: %w", err)
	}
	if item != nil {
		// Get the check type
		var checkType resource.Object
		checkType, err = typesClient.Get(ctx, resource.Identifier{
			Namespace: obj.GetNamespace(),
			Name:      check.ID(),
		})
		if err != nil {
			return err
		}
		// Run the steps
		steps, err := filterSteps(checkType, check.Steps())
		if err != nil {
			return err
		}
		failures, err = runStepsInParallel(ctx, log, &c.Spec, steps, []any{item})
		if err != nil {
			setErr := checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationError)
			if setErr != nil {
				return setErr
			}
			return fmt.Errorf("error running steps: %w", err)
		}
	}
	// Pull failures from the report for the items to retry
	c.Status.Report.Failures = slices.DeleteFunc(c.Status.Report.Failures, func(f advisorv0alpha1.CheckReportFailure) bool {
		if f.ItemID == itemToRetry {
			for _, newFailure := range failures {
				if newFailure.StepID == f.StepID {
					// Same failure found, keep it
					return false
				}
			}
			// Failure no longer found, remove it
			return true
		}
		// Failure not in the list of items to retry, keep it
		return false
	})
	err = checks.SetStatus(ctx, client, obj, c.Status)
	log.Debug("Set status", "check", obj.GetName(), "status.count", c.Status.Report.Count)
	if err != nil {
		return err
	}
	// Delete the retry annotation to mark the check as processed
	annotations := checks.DeleteAnnotations(ctx, obj, []string{checks.RetryAnnotation})
	err = checks.SetAnnotations(ctx, client, obj, annotations)
	log.Debug("Set annotations", "check", obj.GetName(), "annotations", annotations)

	return err
}

func runStepsInParallel(ctx context.Context, log logging.Logger, spec *advisorv0alpha1.CheckSpec, steps []checks.Step, items []any) ([]advisorv0alpha1.CheckReportFailure, error) {
	reportFailures := []advisorv0alpha1.CheckReportFailure{}
	var internalErr error
	var wg sync.WaitGroup
	var mu sync.Mutex
	// Avoid too many concurrent requests
	limit := make(chan struct{}, 10)

	for _, step := range steps {
		for _, item := range items {
			wg.Add(1)
			limit <- struct{}{}
			go func(step checks.Step, item any) {
				defer wg.Done()
				defer func() { <-limit }()
				var stepErr []advisorv0alpha1.CheckReportFailure
				var err error
				func() {
					defer func() {
						if r := recover(); r != nil {
							log.Error("panic recovered in step", "step", step.ID(), "error", r, "item", item)
						}
					}()
					logger := log.With("step", step.ID())
					// Create a copy of the context with a cloned HTTP request to prevent
					// concurrent modifications to the same header map
					safeCtx := contexthandler.CopyWithReqContext(ctx)
					stepErr, err = step.Run(safeCtx, logger, spec, item)
				}()
				mu.Lock()
				defer mu.Unlock()
				if err != nil {
					internalErr = fmt.Errorf("error running step %s: %w", step.ID(), err)
					return
				}
				if len(stepErr) > 0 {
					reportFailures = append(reportFailures, stepErr...)
				}
			}(step, item)
		}
	}
	wg.Wait()
	return reportFailures, internalErr
}

func filterSteps(checkType resource.Object, steps []checks.Step) ([]checks.Step, error) {
	ignoreStepsList := checkType.GetAnnotations()[checks.IgnoreStepsAnnotationList]
	if ignoreStepsList != "" {
		filteredSteps := []checks.Step{}
		ignoreStepsList := strings.Split(ignoreStepsList, ",")
		for _, step := range steps {
			if !slices.Contains(ignoreStepsList, step.ID()) {
				filteredSteps = append(filteredSteps, step)
			}
		}
		return filteredSteps, nil
	}
	return steps, nil
}

// hasAnnotationsOrStatusChanged compares annotations and status between old and new objects
func annotationsChanged(oldObj, newObj resource.Object) bool {
	if oldObj == nil || newObj == nil {
		return true // If either is nil, consider it changed
	}

	// Compare annotations
	oldAnnotations := oldObj.GetAnnotations()
	newAnnotations := newObj.GetAnnotations()
	return !reflect.DeepEqual(oldAnnotations, newAnnotations)
}
