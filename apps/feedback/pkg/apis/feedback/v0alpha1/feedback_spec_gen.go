package v0alpha1

import (
	openapi_types "github.com/deepmap/oapi-codegen/pkg/types"
)

// FeedbackSpec defines model for FeedbackSpec.
// +k8s:openapi-gen=true
type FeedbackSpec struct {
	CanAccessInstance bool                   `json:"canAccessInstance"`
	DiagnosticData    map[string]interface{} `json:"diagnosticData,omitempty"`
	GithubIssueUrl    *string                `json:"githubIssueUrl,omitempty"`
	ImageType         *string                `json:"imageType,omitempty"`
	Message           string                 `json:"message"`
	ReporterEmail     *string                `json:"reporterEmail,omitempty"`
	Screenshot        *openapi_types.File    `json:"screenshot,omitempty"`
	ScreenshotUrl     *string                `json:"screenshotUrl,omitempty"`
}
