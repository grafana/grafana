package userstorage

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/userstorage/v0alpha1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestValidate(t *testing.T) {
	tests := []struct {
		name        string
		requesterID string
		objectName  string
		expectError bool
	}{
		{
			name:        "valid userstorage object",
			requesterID: "123",
			objectName:  "basic-panel:123",
			expectError: false,
		},
		{
			name:        "invalid userstorage object",
			requesterID: "123",
			objectName:  "basic-panel:456",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requester := &identity.StaticRequester{Type: "user", UserUID: tt.requesterID}
			obj := &v0alpha1.UserStorage{
				ObjectMeta: v1.ObjectMeta{
					Name: tt.objectName,
				},
			}
			ctx := identity.WithRequester(context.Background(), requester)

			strategy := newStrategy(nil, schema.GroupVersion{}, prometheus.DefaultRegisterer)
			errs := strategy.Validate(ctx, obj)

			if tt.expectError {
				assert.NotEmpty(t, errs)
			} else {
				assert.Empty(t, errs)
			}
		})
	}
}
