package options

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStorageOptions_Validate(t *testing.T) {
	tests := []struct {
		name    string
		Opts    StorageOptions
		wantErr bool
	}{
		{
			name: "with unified storage grpc and no auth token",
			Opts: StorageOptions{
				StorageType: StorageTypeUnifiedGrpc,
			},
			wantErr: true,
		},
		{
			name: "with unified storage grpc and auth info",
			Opts: StorageOptions{
				StorageType:                              StorageTypeUnifiedGrpc,
				Address:                                  "localhost:10000",
				GrpcClientAuthenticationToken:            "1234",
				GrpcClientAuthenticationTokenExchangeURL: "http://localhost:8080",
				GrpcClientAuthenticationTokenNamespace:   "*",
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := tt.Opts.Validate()
			if tt.wantErr {
				assert.NotEmpty(t, errs)
				return
			}
			assert.Empty(t, errs)
		})
	}
}
