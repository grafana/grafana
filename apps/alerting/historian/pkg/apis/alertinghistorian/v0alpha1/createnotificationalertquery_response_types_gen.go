// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type CreateNotificationAlertQueryNotificationEntryAlert struct {
	Status      string            `json:"status"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt"`
	Enrichments interface{}       `json:"enrichments,omitempty"`
}

// NewCreateNotificationAlertQueryNotificationEntryAlert creates a new CreateNotificationAlertQueryNotificationEntryAlert object.
func NewCreateNotificationAlertQueryNotificationEntryAlert() *CreateNotificationAlertQueryNotificationEntryAlert {
	return &CreateNotificationAlertQueryNotificationEntryAlert{
		Labels:      map[string]string{},
		Annotations: map[string]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationAlertQueryNotificationEntryAlert.
func (CreateNotificationAlertQueryNotificationEntryAlert) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationAlertQueryNotificationEntryAlert"
}

// +k8s:openapi-gen=true
type CreateNotificationAlertQueryResponse struct {
	Alerts []CreateNotificationAlertQueryNotificationEntryAlert `json:"alerts"`
}

// NewCreateNotificationAlertQueryResponse creates a new CreateNotificationAlertQueryResponse object.
func NewCreateNotificationAlertQueryResponse() *CreateNotificationAlertQueryResponse {
	return &CreateNotificationAlertQueryResponse{
		Alerts: []CreateNotificationAlertQueryNotificationEntryAlert{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateNotificationAlertQueryResponse.
func (CreateNotificationAlertQueryResponse) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.historian.pkg.apis.alertinghistorian.v0alpha1.CreateNotificationAlertQueryResponse"
}
