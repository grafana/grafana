package connection

import (
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// SuccessTestResults returns a successful TestResults.
func SuccessTestResults() *provisioning.TestResults {
	return &provisioning.TestResults{
		TypeMeta: metav1.TypeMeta{
			APIVersion: provisioning.APIVERSION,
			Kind:       "TestResults",
		},
		Code:    http.StatusOK,
		Success: true,
	}
}

// FailedTestResults returns a failed TestResults with the given code and errors.
func FailedTestResults(code int, errs []provisioning.ErrorDetails) *provisioning.TestResults {
	return &provisioning.TestResults{
		TypeMeta: metav1.TypeMeta{
			APIVersion: provisioning.APIVERSION,
			Kind:       "TestResults",
		},
		Code:    code,
		Success: false,
		Errors:  errs,
	}
}
