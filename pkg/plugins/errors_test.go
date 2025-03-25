package plugins

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc/metadata"
)

func TestErrPluginGrpcConnectionUnavailableBase(t *testing.T) {
	tests := []struct {
		name           string
		ctx            context.Context
		err            error
		expectedPublic string
	}{
		{
			name:           "without stack ID",
			ctx:            context.Background(),
			err:            errors.New("connection failed"),
			expectedPublic: "Data source became unavailable during request. Please try again.",
		},
		{
			name: "with stack ID",
			ctx: metadata.NewIncomingContext(context.Background(), metadata.New(map[string]string{
				"stackID": "test-stack",
			})),
			err:            errors.New("connection failed"),
			expectedPublic: "Data source became unavailable during request. Please try again. If the problem persists, please contact customer support.",
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
