package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
)

func GetIMSToken(c *contextmodel.ReqContext, tenantId, userId int64) (string, error) {
	// Check if request has jwt set in headers
	jwtToken := c.Req.Header.Get("X-Jwt-Token")
	if jwtToken != "" {
		return jwtToken, nil
	}

	// Check if we have token set in cookies
	jwtCookie, _ := c.Req.Cookie("helix_jwt_token")
	if jwtCookie != nil {
		if jwtCookie.Value != "" {
			return jwtCookie.Value, nil
		}
	}

	// BMC change next block: To support IMS tenant 0
	if tenantId == setting.GF_Tenant0 {
		tenantId = setting.IMS_Tenant0
	}
	// Generate a new service account jwt
	serviceAccountToken, err := GetServiceAccountToken(tenantId)
	if err != nil {
		return "", fmt.Errorf("failed to get service account token")
	}

	// Generate a new user impersonation token
	impersonationToken, err := GetServiceImpersonationToken(userId, serviceAccountToken)
	if err != nil {
		return "", fmt.Errorf("failed to get impersonation token")
	}

	return impersonationToken, nil
}

// GetTenantFeatures GET /tenantfeatures - function
func (hs *HTTPServer) GetTenantFeatures(c *contextmodel.ReqContext) response.Response {
	if !setting.FeatureFlagEnabled {
		return response.JSON(200, []external.Tenantfeatures{})
	}
	imsToken, err := GetIMSToken(c, c.OrgID, c.UserID)
	if err != nil && setting.Env != "development" {
		return response.Error(401, "Failed to authenticate", err)
	}
	availableFeatures := external.GetTenantFeaturesFromService(c.OrgID, imsToken)
	return response.JSON(200, availableFeatures)
}
