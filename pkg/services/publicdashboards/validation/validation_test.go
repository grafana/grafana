package validation

import (
	"testing"

	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidatePublicDashboard(t *testing.T) {
	t.Run("Returns no error when valid shareType value is received", func(t *testing.T) {
		dto := &SavePublicDashboardDTO{DashboardUid: "abc123", OrgId: 1, UserId: 1, PublicDashboard: &PublicDashboard{Share: EmailShareType}}

		err := ValidatePublicDashboard(dto)
		require.NoError(t, err)
	})

	t.Run("Returns error when invalid shareType value", func(t *testing.T) {
		dto := &SavePublicDashboardDTO{DashboardUid: "abc123", OrgId: 1, UserId: 1, PublicDashboard: &PublicDashboard{Share: "invalid"}}

		err := ValidatePublicDashboard(dto)
		require.Error(t, err)
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

func TestValidAccessToken(t *testing.T) {
	t.Run("true", func(t *testing.T) {
		uuid := "da82510c2aa64d78a2e87fef36c58e89"
		assert.True(t, IsValidAccessToken(uuid))
	})

	t.Run("false when blank", func(t *testing.T) {
		assert.False(t, IsValidAccessToken(""))
	})

	t.Run("false when can't be parsed by uuid lib", func(t *testing.T) {
		// too long
		assert.False(t, IsValidAccessToken("0123456789012345678901234567890123456789"))
	})
}

// we just check base cases since this wraps utils.IsValidShortUID which has
// test coverage
func TestValidUid(t *testing.T) {
	t.Run("true", func(t *testing.T) {
		assert.True(t, IsValidShortUID("afqrz7jZZ"))
	})

	t.Run("false when blank", func(t *testing.T) {
		assert.False(t, IsValidShortUID(""))
	})

	t.Run("false when invalid chars", func(t *testing.T) {
		assert.False(t, IsValidShortUID("afqrz7j%%"))
	})
}
