package app

import (
	"context"
	"errors"
	"fmt"
	"sync"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/user"
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

func getStatusAnnotation(obj resource.Object) string {
	return obj.GetAnnotations()[checks.StatusAnnotation]
}

func setStatusAnnotation(ctx context.Context, client resource.Client, obj resource.Object, status string) error {
	annotations := obj.GetAnnotations()
	annotations[checks.StatusAnnotation] = status
	return client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/metadata/annotations",
			Value:     annotations,
		}},
	}, resource.PatchOptions{}, obj)
}

func processCheck(ctx context.Context, client resource.Client, obj resource.Object, check checks.Check) error {
	status := getStatusAnnotation(obj)
	if status != "" {
		// Check already processed
		return nil
	}
	c, ok := obj.(*advisorv0alpha1.Check)
	if !ok {
		return fmt.Errorf("invalid object type")
	}
	// Populate ctx with the user that created the check
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	createdBy := meta.GetCreatedBy()
	typ, uid, err := claims.ParseTypeID(createdBy)
	if err != nil {
		return err
	}
	ctx = identity.WithRequester(ctx, &user.SignedInUser{
		UserUID:      uid,
		FallbackType: typ,
	})
	// Get the items to check
	items, err := check.Items(ctx)
	if err != nil {
		setErr := setStatusAnnotation(ctx, client, obj, "error")
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error initializing check: %w", err)
	}
	// Run the steps
	steps := check.Steps()
	failures, err := runStepsInParallel(ctx, &c.Spec, steps, items)
	if err != nil {
		setErr := setStatusAnnotation(ctx, client, obj, "error")
		if setErr != nil {
			return setErr
		}
		return fmt.Errorf("error running steps: %w", err)
	}

	report := &advisorv0alpha1.CheckV0alpha1StatusReport{
		Failures: failures,
		Count:    int64(len(items)),
	}
	err = setStatusAnnotation(ctx, client, obj, "processed")
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
