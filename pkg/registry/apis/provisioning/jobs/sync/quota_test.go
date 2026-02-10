package sync

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestCheckQuotaBeforeSync(t *testing.T) {
	tracer := tracing.NewNoopTracerService()

	tests := []struct {
		name          string
		netChange     int64
		config        *provisioning.Repository
		setupStats    func(*resources.MockRepositoryResources)
		expectedError string
	}{
		{
			name:      "no resource quota condition - proceeds",
			netChange: 10,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{},
				},
			},
			setupStats: func(_ *resources.MockRepositoryResources) {},
		},
		{
			name:      "resource quota condition with status True - proceeds",
			netChange: 10,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionTrue,
							Reason: "WithinLimit",
						},
					},
				},
			},
			setupStats: func(_ *resources.MockRepositoryResources) {},
		},
		{
			name:      "resource quota exceeded but quota limit is zero (unlimited) - proceeds",
			netChange: 10,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 0,
					},
				},
			},
			setupStats: func(_ *resources.MockRepositoryResources) {},
		},
		{
			name:      "stats error - returns error",
			netChange: 5,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
				},
			},
			setupStats: func(m *resources.MockRepositoryResources) {
				m.EXPECT().Stats(context.Background()).Return(nil, fmt.Errorf("connection error"))
			},
			expectedError: "failed to get repository stats: connection error",
		},
		{
			name:      "final count within quota - proceeds",
			netChange: 5,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
				},
			},
			setupStats: func(m *resources.MockRepositoryResources) {
				m.EXPECT().Stats(context.Background()).Return(&provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 50},
								{Group: "alerting.grafana.app", Resource: "rules", Count: 40},
							},
						},
					},
				}, nil)
			},
		},
		{
			name:      "final count exactly at quota limit - proceeds",
			netChange: 10,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
				},
			},
			setupStats: func(m *resources.MockRepositoryResources) {
				m.EXPECT().Stats(context.Background()).Return(&provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 90},
							},
						},
					},
				}, nil)
			},
		},
		{
			name:      "final count exceeds quota - returns error",
			netChange: 20,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
				},
			},
			setupStats: func(m *resources.MockRepositoryResources) {
				m.EXPECT().Stats(context.Background()).Return(&provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 90},
							},
						},
					},
				}, nil)
			},
			expectedError: "repository is over quota (current: 90 resources) and sync would add 20 resources, resulting in 110 resources exceeding the quota limit of 100. sync cannot proceed",
		},
		{
			name:      "negative net change brings count below quota - proceeds",
			netChange: -10,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
				},
			},
			setupStats: func(m *resources.MockRepositoryResources) {
				m.EXPECT().Stats(context.Background()).Return(&provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 110},
							},
						},
					},
				}, nil)
			},
		},
		{
			name:      "folders are excluded from quota count - proceeds",
			netChange: 5,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
				},
			},
			setupStats: func(m *resources.MockRepositoryResources) {
				m.EXPECT().Stats(context.Background()).Return(&provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 50},
								{Group: "folder.grafana.app", Resource: "folders", Count: 200},
							},
						},
					},
				}, nil)
			},
		},
		{
			name:      "folders excluded - would exceed quota without folder exclusion",
			netChange: 60,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
				},
			},
			setupStats: func(m *resources.MockRepositoryResources) {
				m.EXPECT().Stats(context.Background()).Return(&provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 30},
								{Group: "folder.grafana.app", Resource: "folders", Count: 500},
								{Group: "alerting.grafana.app", Resource: "rules", Count: 5},
							},
						},
					},
				}, nil)
			},
		},
		{
			name:      "multiple managers - counts summed across managers",
			netChange: 5,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonQuotaExceeded,
						},
					},
					Quota: provisioning.QuotaStatus{
						MaxResourcesPerRepository: 100,
					},
				},
			},
			setupStats: func(m *resources.MockRepositoryResources) {
				m.EXPECT().Stats(context.Background()).Return(&provisioning.ResourceStats{
					Managed: []provisioning.ManagerStats{
						{
							Stats: []provisioning.ResourceCount{
								{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 40},
							},
						},
						{
							Stats: []provisioning.ResourceCount{
								{Group: "alerting.grafana.app", Resource: "rules", Count: 56},
							},
						},
					},
				}, nil)
			},
			expectedError: "repository is over quota (current: 96 resources) and sync would add 5 resources, resulting in 101 resources exceeding the quota limit of 100. sync cannot proceed",
		},
		{
			name:      "condition reason is not QuotaExceeded - proceeds",
			netChange: 1000,
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeResourceQuota,
							Status: metav1.ConditionFalse,
							Reason: "SomeOtherReason",
						},
					},
				},
			},
			setupStats: func(_ *resources.MockRepositoryResources) {},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockConfigRepository(t)
			repo.EXPECT().Config().Return(tt.config)

			repoResources := resources.NewMockRepositoryResources(t)
			tt.setupStats(repoResources)

			err := checkQuotaBeforeSync(context.Background(), repo, tt.netChange, repoResources, tracer)

			if tt.expectedError != "" {
				require.EqualError(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
