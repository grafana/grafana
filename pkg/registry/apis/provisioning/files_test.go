package provisioning

import (
	"testing"

	provisioningapi "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestCheckQuota(t *testing.T) {
	tests := []struct {
		name       string
		conditions []metav1.Condition
		isCreate   bool
		expectErr  bool
	}{
		// No conditions (no quota configured)
		{
			name:       "no conditions allows create",
			conditions: nil,
			isCreate:   true,
			expectErr:  false,
		},
		{
			name:       "no conditions allows update",
			conditions: nil,
			isCreate:   false,
			expectErr:  false,
		},

		// Unlimited quota
		{
			name: "unlimited quota allows create",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonQuotaUnlimited,
				},
			},
			isCreate:  true,
			expectErr: false,
		},
		{
			name: "unlimited quota allows update",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonQuotaUnlimited,
				},
			},
			isCreate:  false,
			expectErr: false,
		},

		// Within quota
		{
			name: "within quota allows create",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonWithinQuota,
				},
			},
			isCreate:  true,
			expectErr: false,
		},
		{
			name: "within quota allows update",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonWithinQuota,
				},
			},
			isCreate:  false,
			expectErr: false,
		},

		// Quota reached (at limit)
		{
			name: "quota reached blocks create",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonQuotaReached,
				},
			},
			isCreate:  true,
			expectErr: true,
		},
		{
			name: "quota reached allows update",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionTrue,
					Reason: provisioningapi.ReasonQuotaReached,
				},
			},
			isCreate:  false,
			expectErr: false,
		},

		// Quota exceeded (over limit)
		{
			name: "quota exceeded blocks create",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionFalse,
					Reason: provisioningapi.ReasonQuotaExceeded,
				},
			},
			isCreate:  true,
			expectErr: true,
		},
		{
			name: "quota exceeded blocks update",
			conditions: []metav1.Condition{
				{
					Type:   provisioningapi.ConditionTypeResourceQuota,
					Status: metav1.ConditionFalse,
					Reason: provisioningapi.ReasonQuotaExceeded,
				},
			},
			isCreate:  false,
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockRepository(t)
			repo.On("Config").Return(&provisioningapi.Repository{
				Status: provisioningapi.RepositoryStatus{
					Conditions: tt.conditions,
				},
			})

			err := checkQuota(repo, tt.isCreate)

			if tt.expectErr {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "error should be Forbidden, got: %v", err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
