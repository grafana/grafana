package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/rmsmetadata"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

const DefaultRMSURLString = "http://adereporting-rms:8080"

var RMSURLString string

func GetRMSURL() *url.URL {
	RMSURLString = os.Getenv("ADEREPORTING-RMS-ENDPOINT")
	if RMSURLString == "" {
		RMSURLString = DefaultRMSURLString
	}
	rmsBaseURL, _ := url.Parse(RMSURLString)
	return rmsBaseURL
}

var reverseProxy = httputil.NewSingleHostReverseProxy(GetRMSURL())

func (hs *HTTPServer) GetViewList(c *contextmodel.ReqContext) response.Response {
	extend := c.QueryBoolWithDefault("extend", false)
	insightFinderEnabled := c.QueryBoolWithDefault("insightfinderenabled", false)

	views, err := hs.rmsMetadataService.GetViewList(c.Req.Context(), c.OrgID)
	if err != nil {
		return hs.FailResponse(err)
	}

	var enabledViewIDs map[int64]struct{}
	if insightFinderEnabled {
		viewsEnabled, err := hs.rmsMetadataService.GetViewsEnabledForInsightFinder(c.Req.Context(), c.OrgID)
		if err != nil {
			hs.log.Error("Failed to get views enabled for Insight Finder", err)
			return hs.FailResponse(models.ErrGetInsightFinderViewsFailed)
		}
		if viewsEnabled.SelectedViews == "" {
			// tenant has not saved any preferences yet, making itequivalent to insightFinderEnabled flag being set to false to return ootb and custom views
			hs.log.Info("tenant has not set any view preferences in insight finder table", "orgID", c.OrgID)
		} else {
			// making the object to override from nil, indicating viewsEnabled != ""
			enabledViewIDs = make(map[int64]struct{})
			for _, s := range strings.Split(viewsEnabled.SelectedViews, ",") {
				if id, err := strconv.ParseInt(s, 10, 64); err == nil {
					enabledViewIDs[id] = struct{}{}
				}
			}
		}
	}

	result := make([]*models.View, 0, len(views))
	for _, view := range views {
		if view.Deleted {
			continue
		}

		if insightFinderEnabled {
			if enabledViewIDs == nil {
				// if tenant has not set any preferences, return only ootb, undeleted and with description
				if view.TenantID != 1 || (view.Description == "") {
					continue
				}

			} else {
				// if tenant has set view preferences, only return those that he has enabled
				if _, ok := enabledViewIDs[view.ID]; !ok {
					continue
				}
			}
		}
		v := &models.View{
			ID:              view.ID,
			Name:            view.Name,
			ItsmCompVersion: view.ItsmCompVersion,
			TenantID:        view.TenantID,
			Deleted:         view.Deleted,
		}
		if extend {
			v.Description = view.Description
			v.FileKey = view.FileKey
			v.IsOOTB = view.TenantID == 1
			if view.BaseViewID.Valid {
				v.BaseViewID = view.BaseViewID.Int64
			}
		}
		result = append(result, v)
	}
	return hs.SuccessResponse(&result)
}

func (hs *HTTPServer) GetViewDetails(c *contextmodel.ReqContext) response.Response {
	viewId, err := strconv.ParseInt(web.Params(c.Req)[":viewID"], 10, 64)
	if err != nil {
		return hs.FailResponse(models.ErrViewNotFound)
	}

	rmsURL := RMSURLString

	res, err := hs.rmsMetadataService.GetViewById(c.Req.Context(), c.OrgID, viewId)
	if res == nil || res.FileKey == "" || res.Deleted {
		return hs.FailResponse(models.ErrViewNotFound)
	}
	if err != nil {
		hs.log.Error("Failed to get view from view list", err)
		return hs.FailResponse(models.ErrViewDetailsFailed)
	}
	imsToken, err := GetIMSToken(c, c.OrgID, c.UserID)
	if err != nil {
		return hs.FailResponse(err)
	}

	headers := map[string]string{
		"Authorization": "Bearer " + imsToken,
		"Tenant-Id":     strconv.Itoa(int(c.OrgID)),
	}
	path := rmsURL + "/" + "reportingmetadata/api/v1/BIView"
	queryParams := map[string]string{
		"fileKey":  res.FileKey,
		"viewName": res.Name,
	}

	resp, err := hs.rmsMetadataService.Get(path, headers, queryParams)
	if err != nil {
		if resp != nil {
			var errResp models.RMSErr
			err = json.Unmarshal(resp, &errResp)
			if err == nil {
				return response.JSON(500, CustomResponse{Message: errResp.ErrorCode + " : " + errResp.ErrorMessage})
			}
		}
		hs.log.Error("Failed to get view details from RMS", err)
		return hs.FailResponse(models.ErrViewDetailsFailed)
	}
	var finalResponse models.ViewDetailResp
	err = json.Unmarshal(resp, &finalResponse)
	if err != nil {
		hs.log.Error("Failed to parse rms response in view details", err)
		return hs.FailResponse(models.ErrViewDetailsFailed)
	}
	finalResponse.LogicalModel.ID = res.FileKey
	return hs.SuccessResponse(finalResponse.LogicalModel)
}

func (hs *HTTPServer) GetGeneratedQuery(c *contextmodel.ReqContext) response.Response {
	cmd := &models.GenerateQueryCmd{}

	if err := web.Bind(c.Req, cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request payload", err)
	}

	rmsURL := RMSURLString

	imsToken, err := GetIMSToken(c, c.OrgID, c.UserID)
	if err != nil {
		return hs.FailResponse(err)
	}

	headers := map[string]string{
		"Authorization": "Bearer " + imsToken,
		"Tenant-Id":     strconv.Itoa(int(c.OrgID)),
	}
	path := rmsURL + "/" + "reportingmetadata/api/v1/generate_sql"
	queryParams := map[string]string{}

	b, err := json.Marshal(cmd)
	if err != nil {
		hs.log.Error("Failed to marshal input json", err)
		return hs.FailResponse(models.ErrGenerateSqlFailed)
	}

	resp, err := hs.rmsMetadataService.Post(path, headers, queryParams, b)
	if err != nil {
		if resp != nil {
			var errResp models.RMSErr
			err = json.Unmarshal(resp, &errResp)
			if err == nil {
				return response.JSON(500, CustomResponse{Message: errResp.ErrorCode + " : " + errResp.ErrorMessage})
			}
		}
		hs.log.Error("Failed to generate sql from RMS", err)
		return hs.FailResponse(models.ErrGenerateSqlFailed)
	}

	var finalResponse models.GeneratedSQL
	err = json.Unmarshal(resp, &finalResponse)
	if err != nil {
		hs.log.Error("Failed to parse rms response for generate sql command", err)
		return hs.FailResponse(models.ErrGenerateSqlFailed)
	}

	return hs.SuccessResponse(finalResponse)
}

func (hs *HTTPServer) downloadStudio(c *contextmodel.ReqContext) {
	rmsURL := GetRMSURL()

	imsToken, err := GetIMSToken(c, c.OrgID, c.UserID)
	if err != nil {
		c.Handle(hs.Cfg, 400, err.Error(), err)
		return
	}

	reverseProxy.Director = func(req *http.Request) {
		req.URL.Host = rmsURL.Host
		req.URL.Scheme = rmsURL.Scheme
		req.URL.Path = "/reportingmetadata/api/v1/studio/download"
		req.Header = make(http.Header)
		req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
		req.Header.Set("Authorization", "Bearer "+imsToken)
		req.Header.Set("Tenant-Id", strconv.Itoa(int(c.OrgID)))
		req.Host = rmsURL.Host
	}

	reverseProxy.ServeHTTP(c.Resp, c.Req)
}

func (hs *HTTPServer) validateGenAIEnabledViews(c *contextmodel.ReqContext) response.Response {
	cmd := &models.ValidateGenAIReadyRequest{}
	apiLoggerName := "/insightfinder/validate_submission"

	if err := web.Bind(c.Req, cmd); err != nil {
		hs.log.Error(fmt.Sprintf("Bad request payload: %v", err), "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
		return response.Error(http.StatusBadRequest, "bad request payload for validating genAI enabled Views", err)
	}

	imsToken, err := GetIMSToken(c, c.OrgID, c.UserID)
	if err != nil {
		hs.log.Error(fmt.Sprintf("Error when getting JWT token", err), "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
		return hs.FailResponse(err)
	}

	headers := map[string]string{
		"Authorization": "Bearer " + imsToken,
		"Tenant-Id":     strconv.Itoa(int(c.OrgID)),
	}

	path := RMSURLString + "/reportingmetadata/api/v1/validate_gen_ai_ready"
	queryParams := map[string]string{}

	b, err := json.Marshal(cmd)
	if err != nil {
		hs.log.Error(fmt.Sprintf("Failed to marshal input json: %v", err), "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
		return hs.FailResponse(models.ErrValidationGenAIEnabledFlagFailed)
	}

	resp, err := hs.rmsMetadataService.Post(path, headers, queryParams, b)
	if err != nil {
		if resp != nil {
			var errResp models.RMSErr
			err = json.Unmarshal(resp, &errResp)
			if err == nil {
				return response.JSON(500, CustomResponse{Message: errResp.ErrorCode + " : " + errResp.ErrorMessage})
			}
		}
		hs.log.Error(fmt.Sprintf("Failed to validate genAI enabled fields for views from RMS: %v", err), "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
		return hs.FailResponse(models.ErrValidationGenAIEnabledFlagFailed)
	}

	var finalResponse models.ValidateGenAIReadyResponse
	err = json.Unmarshal(resp, &finalResponse)
	if err != nil {
		hs.log.Error(fmt.Sprintf("Failed to parse rms response: %v", err), "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
		return hs.FailResponse(models.ErrValidationGenAIEnabledFlagFailed)
	}

	return hs.SuccessResponse(finalResponse)
}

func (hs *HTTPServer) editInsightFinderViews(c *contextmodel.ReqContext) response.Response {
	apiLoggerName := "/insightfinder/views"

	var req struct {
		ViewIDs []int64 `json:"viewIDs"`
	}

	// Parse the JSON body from the request
	if err := json.NewDecoder(c.Req.Body).Decode(&req); err != nil {
		hs.log.Error(fmt.Sprintf("Bad request payload, could not parse request body: %v", err), "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
		return response.Error(http.StatusBadRequest, "Bad request payload, could not parse request body for editing insight finder views", err)
	}

	// Get tenant views
	views, err := hs.rmsMetadataService.GetViewList(c.Req.Context(), c.OrgID)

	if err != nil {
		hs.log.Error(fmt.Sprintf("Failed to get view list for validation: %v", err), "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
	}

	// Check that each view ID exists for tenant. And also tenant = 1 or tenantID
	for _, viewID := range req.ViewIDs {
		found := false
		for _, view := range views {
			if view.ID == viewID && (view.TenantID == 1 || view.TenantID == c.OrgID) {
				found = true
				break
			}
		}
		if !found {
			hs.log.Error(fmt.Sprintf("Invalid view ID %d provided", viewID), "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
			return hs.FailResponse(models.ErrInvalidViewID)
		}
	}
	hs.log.Info(fmt.Sprintf("Successfully validated view IDs"), "path", apiLoggerName, "orgId", c.OrgID)

	if err != nil {
		hs.log.Error(fmt.Sprintf("Failed to edit views enabled for Insight Finder: %v", err), "path", apiLoggerName, "orgId", c.OrgID)
		return hs.FailResponse(models.ErrGetInsightFinderViewsFailed)
	}
	viewIDstrs := make([]string, len(req.ViewIDs))
	for i, n := range req.ViewIDs {
		viewIDstrs[i] = strconv.FormatInt(n, 10)
	}
	viewIDStringToinsert := strings.Join(viewIDstrs, ",")

	err = hs.rmsMetadataService.SetViewsEnabledForInsightFinder(c.Req.Context(), c.OrgID, &rmsmetadata.ViewsEnabledForInsightFinder{
		TenantID:      c.OrgID,
		SelectedViews: viewIDStringToinsert,
	})

	if err != nil {
		hs.log.Error(models.ErrUnableToSaveSelectedViews.Error(), "path", apiLoggerName, "orgId", c.OrgID)
		return hs.FailResponse(models.ErrUnableToSaveSelectedViews)
	}

	hs.log.Info("Successfully edited views", "path", apiLoggerName, "orgID", c.OrgID, "userID", c.UserID)
	return hs.SuccessResponse(nil)
}
