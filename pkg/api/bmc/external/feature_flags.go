package external

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.bmc.com/DSOM-ADE/authz-go"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	TenantFeatureCacheKey = "tenant_features_"
)

// GlobalFeatureResponse type
type GlobalFeatureResponse struct {
	Features []Features `json:"features"`
}

// Features type
type Features struct {
	Name         string `json:"Name"`
	State        string `json:"State"`
	Status       bool   `json:"Status"`
	Solution     string `json:"Solution"`
	Description  string `json:"Description"`
	FeatureLevel string `json:"FeatureLevel"`
	ID           int    `json:"id"`
}

type TenantFeatureResponse struct {
	Tenantfeatures []Tenantfeatures `json:"tenantfeatures"`
}
type Tenantfeatures struct {
	Name         string `json:"Name"`
	State        string `json:"State,omitempty"`
	Status       bool   `json:"Status"`
	Solution     string `json:"Solution"`
	Description  string `json:"Description,omitempty"`
	FeatureLevel string `json:"FeatureLevel"`
	ID           int    `json:"id"`
	Tenant       string `json:"Tenant"`
	Disabled     bool   `json:"disabled,omitempty"`
}

func GetTenantFeaturesFromService(tenantId int64, imsToken string) []Tenantfeatures {
	var logger = log.New("feature_flag")

	tenantFeatureResponse := TenantFeatureResponse{
		Tenantfeatures: make([]Tenantfeatures, 0),
	}
	tenantFeaturesURL := fmt.Sprintf("%s/tenantfeatures?Tenant=%d", setting.FeatureFlagEndpoint, tenantId)
	client := http.Client{}
	req, _ := http.NewRequest("GET", tenantFeaturesURL, nil)
	req.Header.Add("Authorization", "Bearer "+imsToken)

	res, err := client.Do(req)
	if res != nil {
		if res.StatusCode != 200 {
			body, _ := ioutil.ReadAll(res.Body)
			defer res.Body.Close()
			if err != nil {
				logger.Info(string(body))
			}
			logger.Info("status is not 200 returning empty array", "status", res.Status)
			return tenantFeatureResponse.Tenantfeatures
		}
	} else {
		logger.Info("result set is null or tenant feature flag service is not available, returning empty array")
		return tenantFeatureResponse.Tenantfeatures
	}
	if err != nil {
		logger.Info(err.Error())
	}

	body, err := io.ReadAll(res.Body)
	defer res.Body.Close()
	if err != nil {
		logger.Info(err.Error())
	}
	if err := json.Unmarshal(body, &tenantFeatureResponse); err != nil {
		logger.Error("failed to unmarshal body")
	}
	return tenantFeatureResponse.Tenantfeatures
}

func GetTenantFeaturesFromServiceForGrafanaAdmin(tenantId int64) []Tenantfeatures {
	var logger = log.New("feature_flag")

	tenantFeatureResponse := TenantFeatureResponse{
		Tenantfeatures: make([]Tenantfeatures, 0),
	}
	tenantFeaturesURL := fmt.Sprintf("%s/admin/tenantfeatures?Tenant=%d", setting.FeatureFlagEndpoint, tenantId)
	apiKey := os.Getenv("OPS_API_KEY")
	if apiKey == "" {
		logger.Error("OPS_API_KEY not set")
		return tenantFeatureResponse.Tenantfeatures
	}
	client := http.Client{}
	req, _ := http.NewRequest("GET", tenantFeaturesURL, nil)
	req.Header.Add("x-bmc-ops-api-key", apiKey)

	res, err := client.Do(req)
	if err != nil {
		logger.Info(err.Error())
		return tenantFeatureResponse.Tenantfeatures
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(res.Body)
		defer res.Body.Close()
		if err != nil {
			logger.Info(string(body))
		}
		logger.Info("status is not 200 returning empty array", "status", res.Status)
		return tenantFeatureResponse.Tenantfeatures
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		logger.Error("failed to read response body", "error", err)
		return tenantFeatureResponse.Tenantfeatures
	}
	if err := json.Unmarshal(body, &tenantFeatureResponse); err != nil {
		logger.Error("failed to unmarshal body", "error", err)
		return tenantFeatureResponse.Tenantfeatures
	}
	return tenantFeatureResponse.Tenantfeatures
}

type FeatureFlag int

const (
	// FeatureFlagRMSMetadata is the feature flag for RMS Metadata
	FeatureFlagRMSMetadata FeatureFlag = iota

	// FeatureFlagGainSight is the feature flag for GainSight
	FeatureFlagGainSight

	// FeatureFlagDashboardBranding is the feature flag for Dashboard Branding
	FeatureFlagDashboardBranding

	// FeatureFlagReportsLogo is the feature flag to enable logo upload for reports
	FeatureFlagReportsLogo

	// FeatureFlagInsightFinder is the feature flag to enable Insight Finder application
	FeatureFlagInsightFinder

	// FeatureFlagBHDLocalization is the feature flag to enable bhd localization
	FeatureFlagBHDLocalization

	// FeatureFlagBHDScenes	is the feature flag to enable dashboard scenes
	FeatureFlagBHDScenes

	// FeatureFlagBHDVariableCaching is the feature flag to enable Redis Variable Caching - DRJ71-18644
	BHD_ENABLE_VAR_CACHING
	// FeatureFlagExternalDatasource is the feature flag to enable elasticsearch and prometheus datasource
	FeatureFlagExternalDatasource
	// BhdDynamicReportBurstingHeader is the feature flag to enable Dynamic Report Bursting - DRJ71-19432
	FeatureFlagDynamicReportBursting
)

func (feature FeatureFlag) String() string {
	switch feature {
	case FeatureFlagRMSMetadata:
		return "rms-metadata"
	case FeatureFlagGainSight:
		return "gainsight"
	case FeatureFlagDashboardBranding:
		return "branding"
	case FeatureFlagReportsLogo:
		return "bhd-reports-logo"
	case FeatureFlagInsightFinder:
		return "bhd-insightfinder"
	case FeatureFlagBHDLocalization:
		return "bhd-localization"
	case FeatureFlagBHDScenes:
		return "bhd-scenes"
	case BHD_ENABLE_VAR_CACHING:
		return "bhd_enable_var_caching"
	case FeatureFlagExternalDatasource:
		return "bhd-external-ds"
	case FeatureFlagDynamicReportBursting:
		return "bhd_dynamic_report_bursting"
	default:
		return ""
	}
}

func (feature FeatureFlag) Enabled(req *http.Request, signedInUser *user.SignedInUser) bool {
	if signedInUser.IsGrafanaAdmin && feature != FeatureFlagExternalDatasource {
		return true
	}

	if !setting.FeatureFlagEnabled {
		return true
	}

	if feature.String() == "" {
		return false
	}

	// BHD_ENABLE_VAR_CACHING requires FeatureFlagBHDScenes to be enabled
	if feature == BHD_ENABLE_VAR_CACHING {
		if !FeatureFlagBHDScenes.Enabled(req, signedInUser) {
			return false
		}
	}

	cacheInstance := authz.GetInstance()
	cacheKey := TenantFeatureCacheKey + strconv.Itoa(int(signedInUser.OrgID))
	if featureFlags, found := cacheInstance.Get(cacheKey); found {
		enabledFeatures := featureFlags.([]string)
		exists := false
		for _, val := range enabledFeatures {
			if val == feature.String() {
				exists = true
				break
			}
		}
		return exists
	} else {
		var tenantFeatures []Tenantfeatures
		if signedInUser.IsGrafanaAdmin {
			tenantFeatures = GetTenantFeaturesFromServiceForGrafanaAdmin(signedInUser.OrgID)
		} else {
			imsToken, err := GetIMSToken(req, signedInUser.OrgID, signedInUser.UserID)
			if err != nil && setting.Env != "development" {
				return false
			}
			tenantFeatures = GetTenantFeaturesFromService(signedInUser.OrgID, imsToken)
		}
		featureFlags := make([]string, 0)
		m := make(map[string]bool)
		for _, tf := range tenantFeatures {
			if tf.Status && !m[tf.Name] {
				m[tf.Name] = true
				featureFlags = append(featureFlags, tf.Name)
			}
		}
		cacheInstance.Set(cacheKey, featureFlags, 60*time.Minute)
		return m[feature.String()]
	}
}

func FeatureAccess(feature FeatureFlag) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		ok := feature.Enabled(c.Req, c.SignedInUser)
		if !ok {
			accessForbidden(c)
		}
	}
}

func accessForbidden(c *contextmodel.ReqContext) {
	if c.IsApiRequest() {
		c.JsonApiErr(403, "Permission denied", nil)
		return
	}

	c.Redirect(setting.AppSubUrl + "/")
}
