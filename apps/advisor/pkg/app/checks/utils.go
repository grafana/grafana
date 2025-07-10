package checks

import (
	"context"
	"fmt"
	"maps"
	"strconv"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

func GetNamespace(stackID string) (string, error) {
	if stackID == "" {
		return metav1.NamespaceDefault, nil
	}
	stackId, err := strconv.ParseInt(stackID, 10, 64)
	if err != nil {
		return "", fmt.Errorf("invalid stack id: %s", stackID)
	}
	return types.CloudNamespaceFormatter(stackId), nil
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
	return client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/metadata/annotations",
			Value:     annotations,
		}},
	}, resource.PatchOptions{}, obj)
}

func SetAnnotations(ctx context.Context, client resource.Client, obj resource.Object, annotations map[string]string) error {
	return client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/metadata/annotations",
			Value:     annotations,
		}},
	}, resource.PatchOptions{}, obj)
}

func SetStatus(ctx context.Context, client resource.Client, obj resource.Object, status any) error {
	return client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/status",
			Value:     status,
		}},
	}, resource.PatchOptions{
		Subresource: "status",
	}, obj)
}
