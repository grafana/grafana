package ofrep

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestReadEvalContext(t *testing.T) {
	b := &APIBuilder{logger: log.NewNopLogger()}

	tests := []struct {
		name        string
		body        string
		expectedCtx evalContext
		expectErr   bool
	}{
		{
			name:        "valid body",
			body:        `{"context":{"namespace":"stacks-1","slug":"myslug"}}`,
			expectedCtx: evalContext{namespace: "stacks-1", slug: "myslug"},
		},
		{
			name:        "empty context fields",
			body:        `{"context":{}}`,
			expectedCtx: evalContext{},
		},
		{
			name:        "empty body",
			body:        ``,
			expectedCtx: evalContext{},
		},
		{
			name:      "malformed JSON",
			body:      `not-json`,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(tt.body))

			evalCtx, err := b.readEvalContext(httptest.NewRecorder(), req)
			if tt.expectErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expectedCtx, evalCtx)

			// Body must still be readable after readEvalContext
			body, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.body, string(body))
		})
	}
}
