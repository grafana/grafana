package validation

import (
	"github.com/google/uuid"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/util"
)

func ValidatePublicDashboard(dto *SavePublicDashboardDTO) error {
	// if it is empty we override it in the service with public for retro compatibility
	if dto.PublicDashboard.Share != "" && !IsValidShareType(dto.PublicDashboard.Share) {
		return ErrInvalidShareType.Errorf("ValidateSavePublicDashboard: invalid share type")
	}

	return nil
}

func ValidateQueryPublicDashboardRequest(req PublicDashboardQueryDTO, pd *PublicDashboard) error {
	if req.IntervalMs < 0 {
		return ErrInvalidInterval.Errorf("ValidateQueryPublicDashboardRequest: intervalMS should be greater than 0")
	}

	if req.MaxDataPoints < 0 {
		return ErrInvalidMaxDataPoints.Errorf("ValidateQueryPublicDashboardRequest: maxDataPoints should be greater than 0")
	}

	if pd.TimeSelectionEnabled {
		timeRange := legacydata.NewDataTimeRange(req.TimeRange.From, req.TimeRange.To)

		_, err := timeRange.ParseFrom()
		if err != nil {
			return ErrInvalidTimeRange.Errorf("ValidateQueryPublicDashboardRequest: time range from is invalid")
		}
		_, err = timeRange.ParseTo()
		if err != nil {
			return ErrInvalidTimeRange.Errorf("ValidateQueryPublicDashboardRequest: time range to is invalid")
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

func IsValidShareType(shareType ShareType) bool {
	for _, t := range ValidShareTypes {
		if t == shareType {
			return true
		}
	}
	return false
}
