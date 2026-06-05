package app

import (
	"context"
	"errors"

	"github.com/grafana/grafana-app-sdk/app"
)

type Config struct {
	ReceiverTestingHandler       ReceiverTestingHandler
	IntegrationTypeSchemaHandler IntegrationTypeSchemaHandler

	// ValidateExternalSyncDatasource is the admission check for the
	// AdminConfig kind's spec.externalAlertmanagerSync.datasourceUid.
	// Implementation lives in the parent process where the datasource
	// service is in scope. Return nil to allow; non-nil error rejects with
	// the error's message. Nil skips validation (test paths).
	ValidateExternalSyncDatasource func(ctx context.Context, uid string) error
}

func (c *Config) Validate() error {
	if c.ReceiverTestingHandler == nil {
		return errors.New("receiver testing handler is required")
	}
	if c.IntegrationTypeSchemaHandler == nil {
		return errors.New("integration type schema handler is required")
	}
	return nil
}

type ReceiverTestingHandler interface {
	HandleReceiverTestingRequest(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error
}

type IntegrationTypeSchemaHandler interface {
	HandleGetSchemas(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error
}
