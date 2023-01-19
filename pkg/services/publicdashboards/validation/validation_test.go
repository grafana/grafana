package validation

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/stretchr/testify/require"
)

func TestValidatePublicDashboard(t *testing.T) {
	t.Run("Returns validation error when dashboard has template variables", func(t *testing.T) {
		templateVars := []byte(`{
			"templating": {
				 "list": [
				   {
					  "name": "templateVariableName"
				   }
				]
			}
		}`)
		dashboardData, _ := simplejson.NewJson(templateVars)
		dashboard := dashboards.NewDashboardFromJson(dashboardData)
		dto := &SavePublicDashboardDTO{DashboardUid: "abc123", OrgId: 1, UserId: 1, PublicDashboard: nil}

		err := ValidatePublicDashboard(dto, dashboard)
		require.ErrorContains(t, err, ErrPublicDashboardHasTemplateVariables.Error())
	})

	t.Run("Returns no validation error when dashboard has no template variables", func(t *testing.T) {
		templateVars := []byte(`{
			"templating": {
				 "list": []
			}
		}`)
		dashboardData, _ := simplejson.NewJson(templateVars)
		dashboard := dashboards.NewDashboardFromJson(dashboardData)
		dto := &SavePublicDashboardDTO{DashboardUid: "abc123", OrgId: 1, UserId: 1, PublicDashboard: nil}

		err := ValidatePublicDashboard(dto, dashboard)
		require.NoError(t, err)
	})
}

func TestValidateQueryPublicDashboardRequest(t *testing.T) {
	type args struct {
		req PublicDashboardQueryDTO
		pd  *PublicDashboard
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "Returns no error when input is valid",
			args: args{
				req: PublicDashboardQueryDTO{
					IntervalMs:    1000,
					MaxDataPoints: 1000,
					TimeRange: TimeSettings{
						From: "now-1h",
						To:   "now",
					},
				},
				pd: &PublicDashboard{
					TimeSelectionEnabled: true,
				},
			},
			wantErr: false,
		},
		{
			name: "Returns no error when input is valid and time selection is disabled",
			args: args{
				req: PublicDashboardQueryDTO{
					IntervalMs:    1000,
					MaxDataPoints: 1000,
				},
				pd: &PublicDashboard{
					TimeSelectionEnabled: false,
				},
			},
			wantErr: false,
		},
		{
			name: "Returns validation error when intervalMs is less than 0",
			args: args{
				req: PublicDashboardQueryDTO{
					IntervalMs: -1,
				},
				pd: &PublicDashboard{},
			},
			wantErr: true,
		},
		{
			name: "Returns validation error when maxDataPoints is less than 0",
			args: args{
				req: PublicDashboardQueryDTO{
					MaxDataPoints: -1,
				},
				pd: &PublicDashboard{},
			},
			wantErr: true,
		},
		{
			name: "Returns validation error when time range from is invalid",
			args: args{
				req: PublicDashboardQueryDTO{
					TimeRange: TimeSettings{
						From: "invalid",
						To:   "1622560000000",
					},
				},
				pd: &PublicDashboard{
					TimeSelectionEnabled: true,
				},
			},
			wantErr: true,
		},
		{
			name: "Returns validation error when time range to is invalid",
			args: args{
				req: PublicDashboardQueryDTO{
					TimeRange: TimeSettings{
						From: "1622560000000",
						To:   "invalid",
					},
				},
				pd: &PublicDashboard{
					TimeSelectionEnabled: true,
				},
			},
			wantErr: true,
		},
		{
			name: "Returns validation error when time range from or to is blank",
			args: args{
				req: PublicDashboardQueryDTO{
					TimeRange: TimeSettings{
						From: "",
						To:   "",
					},
				},
				pd: &PublicDashboard{
					TimeSelectionEnabled: true,
				},
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateQueryPublicDashboardRequest(tt.args.req, tt.args.pd); (err != nil) != tt.wantErr {
				t.Errorf("ValidateQueryPublicDashboardRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
