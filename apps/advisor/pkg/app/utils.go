package app

import (
	"context"
	"errors"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/user"
)

func getCheck(obj resource.Object, checks map[string]checks.Check) (checks.Check, error) {
	labels := obj.GetLabels()
	objTypeLabel, ok := labels[typeLabel]
	if !ok {
		return nil, errors.New("missing check type as label")
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
	errs := []advisorv0alpha1.CheckReportError{}
	for _, step := range steps {
		stepErrs, err := step.Run(ctx, &c.Spec, items)
		if err != nil {
			setErr := setStatusAnnotation(ctx, client, obj, "error")
			if setErr != nil {
				return setErr
			}
			return fmt.Errorf("error running step %s: %w", step.Title(), err)
		}
		errs = append(errs, stepErrs...)
	}
	report := &advisorv0alpha1.CheckV0alpha1StatusReport{
		Errors: errs,
		Count:  int64(len(items)),
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
