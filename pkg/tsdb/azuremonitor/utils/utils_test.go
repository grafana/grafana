package utils

import (
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

func TestCreateResponseErrorFromStatusCode(t *testing.T) {
	tests := []struct {
		name               string
		statusCode         int
		status             string
		body               []byte
		expectedErrMessage string
		expectedType       backend.ErrorSource
	}{
		{
			name:               "Downstream error for 500 status",
			statusCode:         500,
			status:             "500 Internal Server Error",
			body:               []byte("body bytes"),
			expectedErrMessage: "request failed, status: 500 Internal Server Error, body: body bytes",
			expectedType:       backend.ErrorSourceDownstream,
		},
		{
			name:               "Plugin error for 501 status",
			statusCode:         501,
			status:             "501 Not Implemented",
			body:               []byte("body bytes"),
			expectedErrMessage: "request failed, status: 501 Not Implemented, body: body bytes",
			expectedType:       backend.ErrorSourcePlugin,
		},
		{
			name:               "Downstream error for 502 status",
			statusCode:         502,
			status:             "502 Gateway Error",
			body:               []byte("body bytes"),
			expectedErrMessage: "request failed, status: 502 Gateway Error, body: body bytes",
			expectedType:       backend.ErrorSourceDownstream,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CreateResponseErrorFromStatusCode(tt.statusCode, tt.status, tt.body)
			assert.Error(t, err)
			// Check if error is of type ErrorWithSource
			var errorWithSource backend.ErrorWithSource
			assert.True(t, errors.As(err, &errorWithSource))

			// Validate the source of the error
			assert.Equal(t, tt.expectedType, errorWithSource.ErrorSource())
			assert.Contains(t, err.Error(), tt.expectedErrMessage)
		})
	}
}
