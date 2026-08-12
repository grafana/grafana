package plugins

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
)

func TestErrPluginGrpcConnectionUnavailableBase(t *testing.T) {
	tests := []struct {
		name           string
		ctx            context.Context
		err            error
		expectedPublic string
	}{
		{
			name: "without stack ID in context",
			ctx: identity.WithRequester(context.Background(), &identity.StaticRequester{
				Namespace: "org-123",
			}),
			err:            errors.New("connection failed"),
			expectedPublic: "Data source became unavailable during request. Please try again.",
		},
		{
			name: "with stack ID in context",
			ctx: identity.WithRequester(context.Background(), &identity.StaticRequester{
				Namespace: "stacks-123",
			}),
			err:            errors.New("connection failed"),
			expectedPublic: "Data source became unavailable during request. Please try again. If the problem persists, please contact customer support.",
		},
		{
			name:           "without static requester in context",
			ctx:            context.Background(),
			err:            errors.New("connection failed"),
			expectedPublic: "Data source became unavailable during request. Please try again.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ErrPluginGrpcConnectionUnavailableBaseFn(tt.ctx).Errorf("%v", tt.err)
			assert.Error(t, err)

			// Check if it's a Grafana error
			var grafanaErr errutil.Error
			assert.ErrorAs(t, err, &grafanaErr)

			// Check the public message
			publicErr := grafanaErr.Public()
			assert.Equal(t, tt.expectedPublic, publicErr.Message)
		})
	}
}
