package api

import (
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"github.bmc.com/DSOM-ADE/authz-go"
	rbac "github.com/grafana/grafana/pkg/api/bmc/bhd_rbac"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
)

// @example: IsTenantFeatureEnabled(hs, "rms-metadata")
// Below utility function can be used to create in memory cache.
func IsTenantFeatureEnabled(hs *HTTPServer, featureName string) func(c *contextmodel.ReqContext) {
	return func(c *contextmodel.ReqContext) {
		cacheInstance := authz.GetInstance()
		cacheKey := external.TenantFeatureCacheKey + strconv.Itoa(int(c.OrgID))
		if featureFlags, found := cacheInstance.Get(cacheKey); found {
			enabledFeatures := featureFlags.([]string)
			exists := false
			for _, val := range enabledFeatures {
				if val == featureName {
					exists = true
					break
				}
			}
			if !exists {
				c.JsonApiErr(403, "Permission denied", nil)
				return
			}
		} else {
			imsToken, err := GetIMSToken(c, c.OrgID, c.UserID)
			if err != nil {
				c.JsonApiErr(403, "Permission denied", nil)
				return
			}
			tenantFeatures := external.GetTenantFeaturesFromService(c.OrgID, imsToken)
			featureFlags := make([]string, 0)
			m := make(map[string]bool)
			for _, tf := range tenantFeatures {
				if tf.Status && !m[tf.Name] {
					m[tf.Name] = true
					featureFlags = append(featureFlags, tf.Name)
				}
			}
			cacheInstance.Set(cacheKey, featureFlags, 120*time.Minute)
			if !m[featureName] {
				c.JsonApiErr(403, "Permission denied", nil)
				return
			}
		}
	}
}

func (hs *HTTPServer) registerRMSMetadataRoutes() {
	reqSignedIn := middleware.ReqSignedIn
	reqOrgAdmin := middleware.ReqOrgAdmin
	r := hs.RouteRegister

	r.Group("/api/rmsmetadata", func(apiRoute routing.RouteRegister) {
		// Register admin persona routes to below group with admin permission
		apiRoute.Group("/adminop", func(adminRoute routing.RouteRegister) {}, reqOrgAdmin)

		// Register user persona routes to below group with editor permission
		apiRoute.Group("/view", func(userPersonaRoute routing.RouteRegister) {
			userPersonaRoute.Get("/list", rbac.CanAccessViewList, routing.Wrap(hs.GetViewList))
			userPersonaRoute.Get("/:viewID", rbac.CanAccessViews, routing.Wrap(hs.GetViewDetails))
			userPersonaRoute.Post("/generatequery", rbac.CanAccessViews, routing.Wrap(hs.GetGeneratedQuery))
		})

		// Register admin persona routes to below group with admin permission
		apiRoute.Group("/studio", func(adminPersonnaRoute routing.RouteRegister) {
			adminPersonnaRoute.Get("/download", hs.downloadStudio)
		}, reqOrgAdmin)

		// Routes for insight finder operations
		// The get view list for insight finder is through /view/list API by passing additional params
		apiRoute.Group("/insightfinder", func(insightFinderRoute routing.RouteRegister) {
			insightFinderRoute.Post("/views", hs.editInsightFinderViews)
			insightFinderRoute.Post("/validate_submission", hs.validateGenAIEnabledViews)
		}, reqOrgAdmin)

	}, reqSignedIn)
}
