package app

import (
	"context"
	"errors"

	"github.com/grafana/grafana-app-sdk/app"
)

type Config struct {
	ReceiverTestingHandler ReceiverTestingHandler
}

func (c *Config) Validate() error {
	if c.ReceiverTestingHandler == nil {
		return errors.New("receiver testing handler is required")
	}
	return nil
}

type ReceiverTestingHandler interface {
	HandleReceiverTestingRequest(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error
}
