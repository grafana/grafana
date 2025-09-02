package signature

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestNewGrafanaSigner(t *testing.T) {
	signer := NewGrafanaSigner()
	require.NotNil(t, signer, "signer should not be nil")
	require.IsType(t, &grafanaSigner{}, signer, "signer should be of type *grafanaSigner")
}

func TestGrafanaSigner_Sign(t *testing.T) {
	tests := []struct {
		name               string
		creationTimestamp  time.Time
		updateTimestampErr error
		updatedTimestamp   *time.Time
		expectedTime       time.Time
		setupMocks         func(meta *utils.MockGrafanaMetaAccessor)
	}{
		{
			name:               "should use creation timestamp when no update timestamp",
			creationTimestamp:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			updatedTimestamp:   ptr(time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)),
			updateTimestampErr: errors.New("failed"),
			expectedTime:       time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			setupMocks: func(meta *utils.MockGrafanaMetaAccessor) {
				meta.On("GetCreationTimestamp").Return(metav1.Time{Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)})
			},
		},
		{
			name:              "should use creation timestamp when update timestamp is nil",
			creationTimestamp: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			updatedTimestamp:  nil,
			expectedTime:      time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			setupMocks: func(meta *utils.MockGrafanaMetaAccessor) {
				meta.On("GetCreationTimestamp").Return(metav1.Time{Time: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)})
			},
		},
		{
			name:              "should use update timestamp when available",
			creationTimestamp: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			updatedTimestamp:  ptr(time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC)),
			expectedTime:      time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			meta := utils.NewMockGrafanaMetaAccessor(t)
			var updatedTime *time.Time
			if tt.updatedTimestamp != nil {
				updatedTime = tt.updatedTimestamp
			}
			meta.On("GetUpdatedTimestamp").Return(updatedTime, tt.updateTimestampErr)

			if tt.setupMocks != nil {
				tt.setupMocks(meta)
			}

			signer := NewGrafanaSigner()
			ctx := context.Background()

			signedCtx, err := signer.Sign(ctx, meta)
			require.NoError(t, err)

			// Verify the signature in the context
			sig := repository.GetAuthorSignature(signedCtx)
			require.NotNil(t, sig, "signature should be present in context")
			require.Equal(t, "grafana", sig.Name)
			require.Equal(t, tt.expectedTime, sig.When)

			meta.AssertExpectations(t)
		})
	}
}

func ptr[T any](v T) *T {
	return &v
}
