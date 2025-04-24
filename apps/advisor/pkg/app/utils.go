package app

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
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

func processCheck(ctx context.Context, client resource.Client, obj resource.Object, check checks.Check) error {
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
	items, err := check.Items(ctx)
	if err != nil {
		setErr := checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationError)
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error initializing check: %w", err)
	}
	// Run the steps
	steps := check.Steps()
	failures, err := runStepsInParallel(ctx, &c.Spec, steps, items)
	if err != nil {
		setErr := checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationError)
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error running steps: %w", err)
	}

	report := &advisorv0alpha1.CheckV0alpha1StatusReport{
		Failures: failures,
		Count:    int64(len(items)),
	}
	err = checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationProcessed)
	if err != nil {
		return err
	}
	return client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/status/report",
			Value:     *report,
		}},
	}, resource.PatchOptions{}, obj)
}

func processCheckRetry(ctx context.Context, client resource.Client, obj resource.Object, check checks.Check) error {
	status := checks.GetStatusAnnotation(obj)
	if status == "" || status == checks.StatusAnnotationError {
		// Check not processed yet or errored
		return nil
	}
	// Get the item to retry from the annotation
	itemToRetry := checks.GetRetryAnnotation(obj)
	if itemToRetry == "" {
		// No item to retry, nothing to do
		return nil
	}
	c, ok := obj.(*advisorv0alpha1.Check)
	if !ok {
		return fmt.Errorf("invalid object type")
	}
	// Get the items to check
	item, err := check.Item(ctx, itemToRetry)
	if err != nil {
		setErr := checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationError)
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error initializing check: %w", err)
	}
	// Run the steps
	steps := check.Steps()
	failures, err := runStepsInParallel(ctx, &c.Spec, steps, []any{item})
	if err != nil {
		setErr := checks.SetStatusAnnotation(ctx, client, obj, checks.StatusAnnotationError)
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error running steps: %w", err)
	}
	// Pull failures from the report for the items to retry
	c.CheckStatus.Report.Failures = slices.DeleteFunc(c.CheckStatus.Report.Failures, func(f advisorv0alpha1.CheckReportFailure) bool {
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
	// Delete the retry annotation to mark the check as processed
	annotations := obj.GetAnnotations()
	delete(annotations, checks.RetryAnnotation)
	return client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/status/report",
			Value:     c.CheckStatus.Report,
		}, {
			Operation: resource.PatchOpAdd,
			Path:      "/metadata/annotations",
			Value:     annotations,
		}},
	}, resource.PatchOptions{}, obj)
}

func runStepsInParallel(ctx context.Context, spec *advisorv0alpha1.CheckSpec, steps []checks.Step, items []any) ([]advisorv0alpha1.CheckReportFailure, error) {
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
				stepErr, err := step.Run(ctx, spec, item)
				mu.Lock()
				defer mu.Unlock()
				if err != nil {
					internalErr = fmt.Errorf("error running step %s: %w", step.ID(), err)
					return
				}
				if stepErr != nil {
					reportFailures = append(reportFailures, *stepErr)
				}
			}(step, item)
		}
	}
	wg.Wait()
	return reportFailures, internalErr
}
