package signature

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/resources"
)

func TestSignerFactory_New(t *testing.T) {
	tests := []struct {
		name          string
		opts          SignOptions
		setupMocks    func(t *testing.T, clients *resources.MockClientFactory)
		expectedType  interface{}
		expectedError string
	}{
		{
			name: "should return grafana signer when history is false",
			opts: SignOptions{
				History: false,
			},
			setupMocks: func(t *testing.T, clients *resources.MockClientFactory) {
				// No mocks needed as we shouldn't call any clients
			},
			expectedType: &grafanaSigner{},
		},
		{
			name: "should return load users once signer when history is true",
			opts: SignOptions{
				History:   true,
				Namespace: "test-ns",
			},
			setupMocks: func(t *testing.T, clients *resources.MockClientFactory) {
				mockResourceClients := resources.NewMockResourceClients(t)
				clients.On("Clients", context.Background(), "test-ns").Return(mockResourceClients, nil)
				mockResourceClients.On("User").Return(nil, nil)
			},
			expectedType: &loadUsersOnceSigner{},
		},
		{
			name: "should return error when clients factory fails",
			opts: SignOptions{
				History:   true,
				Namespace: "test-ns",
			},
			setupMocks: func(t *testing.T, clients *resources.MockClientFactory) {
				clients.On("Clients", context.Background(), "test-ns").Return(nil, fmt.Errorf("clients error"))
			},
			expectedError: "get clients: clients error",
		},
		{
			name: "should return error when user client fails",
			opts: SignOptions{
				History:   true,
				Namespace: "test-ns",
			},
			setupMocks: func(t *testing.T, clients *resources.MockClientFactory) {
				mockResourceClients := resources.NewMockResourceClients(t)
				clients.On("Clients", context.Background(), "test-ns").Return(mockResourceClients, nil)
				mockResourceClients.On("User").Return(nil, fmt.Errorf("user client error"))
			},
			expectedError: "get user client: user client error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClients := resources.NewMockClientFactory(t)
			tt.setupMocks(t, mockClients)

			factory := NewSignerFactory(mockClients)
			signer, err := factory.New(context.Background(), tt.opts)

			if tt.expectedError != "" {
				require.Error(t, err)
				require.EqualError(t, err, tt.expectedError)
				require.Nil(t, signer)
			} else {
				require.NoError(t, err)
				require.NotNil(t, signer)
				require.IsType(t, tt.expectedType, signer, "signer should be of expected type")
			}

			mockClients.AssertExpectations(t)
		})
	}
}
