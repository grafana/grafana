package legacyclient

import (
	"context"
	"errors"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func (c *LegacyClient) LegacyCheck(ctx context.Context, req *authzv1.LegacyCheckRequest) (allowed bool, err error) {
	ctx, span := c.tracer.Start(ctx, "LegacyClient.LegacyCheck")
	defer func() {
		if err != nil {
			span.RecordError(err)
		}

		span.End()
	}()

	if c.clientV1 == nil {
		return false, errors.New("legacy check client is not configured")
	}

	resp, err := c.clientV1.LegacyCheck(ctx, req)
	if err != nil {
		return false, err
	}

	if resp == nil {
		return false, errors.New("legacy check returned no response")
	}

	if responseError := resp.GetError(); responseError != "" {
		return false, errors.New(responseError)
	}

	return resp.GetAllowed(), nil
}
