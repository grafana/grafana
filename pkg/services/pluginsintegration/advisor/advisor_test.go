package advisor

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/datasourcecheck"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/plugincheck"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestService_ReportSummary(t *testing.T) {
	now := time.Now()
	earlier := now.Add(-1 * time.Hour)

	tests := []struct {
		name           string
		config         *setting.Cfg
		restConfigErr  error
		listItems      []resource.Object
		listErr        error
		expectedReport *ReportInfo
		expectedErr    error
	}{
		{
			name: "should return correct report with multiple checks",
			config: &setting.Cfg{
				StackID: "test-stack",
			},
			listItems: []resource.Object{
				&advisorv0alpha1.Check{
					ObjectMeta: metav1.ObjectMeta{
						CreationTimestamp: metav1.Time{Time: earlier},
						Labels: map[string]string{
							checks.TypeLabel: plugincheck.CheckID,
						},
					},
					Status: advisorv0alpha1.CheckStatus{
						Report: advisorv0alpha1.CheckReport{
							Failures: []advisorv0alpha1.CheckReportFailure{
								{StepID: plugincheck.UpdateStepID},
							},
						},
					},
				},
				&advisorv0alpha1.Check{
					ObjectMeta: metav1.ObjectMeta{
						CreationTimestamp: metav1.Time{Time: now},
						Labels: map[string]string{
							checks.TypeLabel: plugincheck.CheckID,
						},
					},
					Status: advisorv0alpha1.CheckStatus{
						Report: advisorv0alpha1.CheckReport{
							Failures: []advisorv0alpha1.CheckReportFailure{
								{StepID: plugincheck.UpdateStepID},
								{StepID: plugincheck.DeprecationStepID},
							},
						},
					},
				},
				&advisorv0alpha1.Check{
					ObjectMeta: metav1.ObjectMeta{
						CreationTimestamp: metav1.Time{Time: now},
						Labels: map[string]string{
							checks.TypeLabel: datasourcecheck.CheckID,
						},
					},
					Status: advisorv0alpha1.CheckStatus{
						Report: advisorv0alpha1.CheckReport{
							Failures: []advisorv0alpha1.CheckReportFailure{
								{StepID: datasourcecheck.HealthCheckStepID},
								{StepID: datasourcecheck.HealthCheckStepID},
							},
						},
					},
				},
			},
			expectedReport: &ReportInfo{
				PluginsOutdated:      1,
				PluginsDeprecated:    1,
				DatasourcesUnhealthy: 2,
			},
		},
		{
			name: "should handle empty check list",
			config: &setting.Cfg{
				StackID: "test-stack",
			},
			listItems: []resource.Object{},
			expectedReport: &ReportInfo{
				PluginsOutdated:      0,
				PluginsDeprecated:    0,
				DatasourcesUnhealthy: 0,
			},
		},
		{
			name: "should handle list error",
			config: &setting.Cfg{
				StackID: "test-stack",
			},
			listErr:     assert.AnError,
			expectedErr: assert.AnError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			client := &mockClient{
				listItems: tt.listItems,
				listErr:   tt.listErr,
			}

			service := &Service{
				cfg:             tt.config,
				namespace:       "stacks-0",
				clientGenerator: func(ctx context.Context) (resource.Client, error) { return client, nil },
			}

			// Execute
			report, err := service.ReportSummary(context.Background())

			// Verify
			if tt.expectedErr != nil {
				assert.Error(t, err)
				assert.Equal(t, tt.expectedErr, err)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedReport, report)
		})
	}
}

type mockClient struct {
	resource.Client
	listItems []resource.Object
	listErr   error
}

func (m *mockClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (resource.ListObject, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	return &mockListObject{items: m.listItems}, nil
}

type mockListObject struct {
	resource.ListObject
	items []resource.Object
}

func (m *mockListObject) GetItems() []resource.Object {
	return m.items
}
