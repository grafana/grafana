package datasource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateAuthProxyHeader(t *testing.T) {
	tests := []struct {
		name                string
		authProxyHeaderName string
		jsonData            map[string]any
		wantErr             bool
		errContains         string
	}{
		{
			name:                "nil jsonData passes",
			authProxyHeaderName: "X-WEBAUTH-USER",
			jsonData:            nil,
			wantErr:             false,
		},
		{
			name:                "empty jsonData passes",
			authProxyHeaderName: "X-WEBAUTH-USER",
			jsonData:            map[string]any{},
			wantErr:             false,
		},
		{
			name:                "blocks matching auth proxy header",
			authProxyHeaderName: "X-WEBAUTH-USER",
			jsonData: map[string]any{
				"httpHeaderName1": "X-WEBAUTH-USER",
			},
			wantErr:     true,
			errContains: "forbidden to add a data source header with a name equal to auth proxy header name",
		},
		{
			name:                "blocks matching auth proxy header (case insensitive)",
			authProxyHeaderName: "X-WEBAUTH-USER",
			jsonData: map[string]any{
				"httpHeaderName1": "x-webauth-user",
			},
			wantErr:     true,
			errContains: "forbidden to add a data source header with a name equal to auth proxy header name",
		},
		{
			name:                "allows different header",
			authProxyHeaderName: "X-WEBAUTH-USER",
			jsonData: map[string]any{
				"httpHeaderName1": "X-Custom-Header",
			},
			wantErr: false,
		},
		{
			name:                "non-header jsonData fields pass",
			authProxyHeaderName: "X-WEBAUTH-USER",
			jsonData: map[string]any{
				"someOtherField": "X-WEBAUTH-USER",
			},
			wantErr: false,
		},
		{
			name:                "multiple headers - one matches",
			authProxyHeaderName: "X-WEBAUTH-USER",
			jsonData: map[string]any{
				"httpHeaderName1": "X-Custom-Header",
				"httpHeaderName2": "X-WEBAUTH-USER",
			},
			wantErr:     true,
			errContains: "forbidden",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAuthProxyHeader(tt.jsonData, tt.authProxyHeaderName)
			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}
