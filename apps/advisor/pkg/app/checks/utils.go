package checks

import (
	"fmt"
	"strconv"

	"github.com/grafana/authlib/types"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	TypeLabel        = "advisor.grafana.app/type"
	StatusAnnotation = "advisor.grafana.app/status"
)

func NewCheckReportFailure(
	severity advisor.CheckReportFailureSeverity,
	stepID string,
	item string,
	links []advisor.CheckErrorLink,
) *advisor.CheckReportFailure {
	return &advisor.CheckReportFailure{
		Severity: severity,
		StepID:   stepID,
		Item:     item,
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
