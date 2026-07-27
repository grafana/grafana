package validation

import (
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/models"
	"github.com/grafana/grafana/pkg/util"
)

func ValidatePublicDashboard(dto *models.SavePublicDashboardDTO) error {
	// if it is empty we override it in the service with public for retro compatibility
	if dto.PublicDashboard.Share != "" && !IsValidShareType(dto.PublicDashboard.Share) {
		return models.ErrInvalidShareType.Errorf("ValidateSavePublicDashboard: invalid share type")
	}

	return nil
}

func ValidateQueryPublicDashboardRequest(req models.PublicDashboardQueryDTO, pd *models.PublicDashboard) error {
	if req.IntervalMs < 0 {
		return models.ErrInvalidInterval.Errorf("ValidateQueryPublicDashboardRequest: intervalMS should be greater than 0")
	}

	if req.MaxDataPoints < 0 {
		return models.ErrInvalidMaxDataPoints.Errorf("ValidateQueryPublicDashboardRequest: maxDataPoints should be greater than 0")
	}

	if pd.TimeSelectionEnabled {
		timeRange := gtime.NewTimeRange(req.TimeRange.From, req.TimeRange.To)

		_, err := timeRange.ParseFrom()
		if err != nil {
			return models.ErrInvalidTimeRange.Errorf("ValidateQueryPublicDashboardRequest: time range from is invalid")
		}
		_, err = timeRange.ParseTo()
		if err != nil {
			return models.ErrInvalidTimeRange.Errorf("ValidateQueryPublicDashboardRequest: time range to is invalid")
		}
	}

	return nil
}

// IsValidAccessToken asserts that an accessToken is a valid uuid
func IsValidAccessToken(token string) bool {
	_, err := uuid.Parse(token)
	return err == nil
}

// IsValidShortUID checks that the uid is not blank and contains valid
// characters. Wraps utils.IsValidShortUID
func IsValidShortUID(uid string) bool {
	return uid != "" && util.IsValidShortUID(uid)
}

func IsValidShareType(shareType models.ShareType) bool {
	for _, t := range models.ValidShareTypes {
		if t == shareType {
			return true
		}
	}
	return false
}
