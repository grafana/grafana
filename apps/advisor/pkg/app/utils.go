package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

func getCheck(obj resource.Object, checks map[string]checks.Check) (checks.Check, error) {
	labels := obj.GetLabels()
	objTypeLabel, ok := labels[typeLabel]
	if !ok {
		return nil, fmt.Errorf("missing check type as label")
	}
	c, ok := checks[objTypeLabel]
	if !ok {
		supportedTypes := ""
		for k := range checks {
			supportedTypes += k + ", "
		}
		return nil, fmt.Errorf("unknown check type %s. Supported types are: %s", objTypeLabel, supportedTypes)
	}

	return c, nil
}

func getStatusAnnotation(obj resource.Object) string {
	return obj.GetAnnotations()[statusAnnotation]
}

func setStatusAnnotation(ctx context.Context, client resource.Client, obj resource.Object, status string) error {
	annotations := obj.GetAnnotations()
	annotations[statusAnnotation] = status
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
	report, err := check.Run(ctx, &c.Spec)
	if err != nil {
		setErr := setStatusAnnotation(ctx, client, obj, "error")
		if setErr != nil {
			return setErr
		}
		return err
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
