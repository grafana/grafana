package checks

import (
	"context"
	"fmt"
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
	StatusAnnotationError     = "error"
	StatusAnnotationProcessed = "processed"
)

func NewCheckReportFailure(
	severity advisor.CheckReportFailureSeverity,
	stepID string,
	item string,
	itemID string,
	links []advisor.CheckErrorLink,
) *advisor.CheckReportFailure {
	return &advisor.CheckReportFailure{
		Severity: severity,
		StepID:   stepID,
		Item:     item,
		ItemID:   itemID,
		Links:    links,
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

func SetStatusAnnotation(ctx context.Context, client resource.Client, obj resource.Object, status string) error {
	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[StatusAnnotation] = status
	return client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
		Operations: []resource.PatchOperation{{
			Operation: resource.PatchOpAdd,
			Path:      "/metadata/annotations",
			Value:     annotations,
		}},
	}, resource.PatchOptions{}, obj)
}
