package checks

import (
	"context"
	"fmt"
	"maps"
	"strconv"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	TypeLabel                 = "advisor.grafana.app/type"
	StatusAnnotation          = "advisor.grafana.app/status"
	RetryAnnotation           = "advisor.grafana.app/retry"
	IgnoreStepsAnnotation     = "advisor.grafana.app/ignore-steps"
	IgnoreStepsAnnotationList = "advisor.grafana.app/ignore-steps-list"
	NameAnnotation            = "advisor.grafana.app/checktype-name"
	StatusAnnotationError     = "error"
	StatusAnnotationProcessed = "processed"
)

func NewCheckReportFailure(
	severity advisor.CheckReportFailureSeverity,
	stepID string,
	item string,
	itemID string,
	links []advisor.CheckErrorLink,
) advisor.CheckReportFailure {
	return advisor.CheckReportFailure{
		Severity: severity,
		StepID:   stepID,
		Item:     item,
		ItemID:   itemID,
		Links:    links,
	}
}

func NewCheckReportFailureWithMoreInfo(
	severity advisor.CheckReportFailureSeverity,
	stepID string,
	item string,
	itemID string,
	links []advisor.CheckErrorLink,
	moreInfo string,
) advisor.CheckReportFailure {
	return advisor.CheckReportFailure{
		Severity: severity,
		StepID:   stepID,
		Item:     item,
		ItemID:   itemID,
		Links:    links,
		MoreInfo: &moreInfo,
	}
}

func GetNamespaces(ctx context.Context, stackID string, orgService org.Service) ([]string, error) {
	var namespaces []string
	if stackID != "" {
		// Single namespace for cloud stack
		stackId, err := strconv.ParseInt(stackID, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid stack id: %s", stackID)
		}
		namespaces = []string{types.CloudNamespaceFormatter(stackId)}
	} else {
		// Multiple namespaces for each org
		orgs, err := orgService.Search(ctx, &org.SearchOrgsQuery{})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch orgs: %w", err)
		}
		for _, o := range orgs {
			namespaces = append(namespaces, types.OrgNamespaceFormatter(o.ID))
		}
	}
	return namespaces, nil
}

func GetStatusAnnotation(obj resource.Object) string {
	return obj.GetAnnotations()[StatusAnnotation]
}

func GetRetryAnnotation(obj resource.Object) string {
	return obj.GetAnnotations()[RetryAnnotation]
}

func AddAnnotations(ctx context.Context, obj resource.Object, annotations map[string]string) map[string]string {
	existingAnnotations := obj.GetAnnotations()
	if existingAnnotations == nil {
		existingAnnotations = map[string]string{}
	}
	maps.Copy(existingAnnotations, annotations)
	return existingAnnotations
}

func DeleteAnnotations(ctx context.Context, obj resource.Object, annotations []string) map[string]string {
	existingAnnotations := obj.GetAnnotations()
	if existingAnnotations == nil {
		existingAnnotations = map[string]string{}
	}
	for _, annotation := range annotations {
		delete(existingAnnotations, annotation)
	}
	return existingAnnotations
}

func SetStatusAnnotation(ctx context.Context, client resource.Client, obj resource.Object, status string) error {
	annotations := AddAnnotations(ctx, obj, map[string]string{StatusAnnotation: status})
	obj.SetAnnotations(annotations)
	_, err := client.Update(ctx, obj.GetStaticMetadata().Identifier(), obj, resource.UpdateOptions{})
	return err
}

func SetAnnotations(ctx context.Context, client resource.Client, obj resource.Object, annotations map[string]string) error {
	obj.SetAnnotations(annotations)
	_, err := client.Update(ctx, obj.GetStaticMetadata().Identifier(), obj, resource.UpdateOptions{})
	return err
}

func SetStatus(ctx context.Context, client resource.Client, obj resource.Object, status any) error {
	// For status updates, we need to use UpdateStatus method if available
	// or set the status field directly on the object
	if statusObj, ok := obj.(interface{ SetStatus(any) }); ok {
		statusObj.SetStatus(status)
	}
	_, err := client.Update(ctx, obj.GetStaticMetadata().Identifier(), obj, resource.UpdateOptions{
		Subresource: "status",
	})
	return err
}
