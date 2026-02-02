package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	"github.com/grafana/grafana/pkg/bhdcodes"
	"github.com/grafana/grafana/pkg/bmc/audit"
	"github.com/grafana/grafana/pkg/infra/db"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	rs "github.com/grafana/grafana/pkg/services/scheduler"
	"github.com/grafana/grafana/pkg/web"
)

var (
	OK      = 1
	WARNING = 2
	ERROR   = 3

	Created     = "Report is successfully created"
	Updated     = "Report is successfully updated"
	DeletedOne  = "Report is successfully deleted"
	DeletedMany = "Reports are successfully deleted"
	EnableOne   = "Report is successfully enabled"
	EnableMany  = "Reports are successfully enabled"
	DisableOne  = "Report is successfully disabled"
	DisableMany = "Reports are successfully disabled"
	Executed    = "Report is successfully executed"
)

// -------------- Controllers To Queries Dispatchers  -------------- //
func (hs *HTTPServer) DeleteRSByDashIds(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.ListRS{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while deleting report scheduler", err)
	}
	query := models.DeleteRSByDashIds{Ids: cmd.Ids, UserId: c.UserID, OrgId: c.OrgID}
	if err := hs.sqlStore.DeleteRSByDashIds(c.Req.Context(), &query); err != nil {
		return hs.FailResponse(err)
	}
	message := DeletedOne
	bhdCode := bhdcodes.ReportDeleteSuccess
	if len(cmd.Ids) > 1 {
		message = DeletedMany
		bhdCode = bhdcodes.ReportsDeleteSuccess
	}
	return hs.SuccessResponse(CustomResponse{Ids: cmd.Ids, Message: message, BHDCode: bhdCode})
}

// Get the Resport Schedule details for audit
func getRSDataForAudit(c *contextmodel.ReqContext, hs *HTTPServer, ids []int64) []audit.RSAudit {
	rsAudit := []audit.RSAudit{}

	reports := &models.GetByIds{
		UserId:     c.UserID,
		OrgId:      c.OrgID,
		Ids:        ids,
		IsOrgAdmin: c.OrgRole == org.RoleAdmin || c.HasBHDPermission("administration.reports", "manage"),
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := hs.sqlStore.GetRSByIds(ctx, reports); err != nil {
		hs.log.Error("Error while getting Report Schedule Details for Audit")
	}

	for _, report := range reports.Result {
		rsData := audit.RSAudit{
			Id:         report.Id,
			Name:       report.Name,
			ReportType: report.ReportType,
		}
		rsAudit = append(rsAudit, rsData)
	}

	return rsAudit

}

func EnableRSAudit(c *contextmodel.ReqContext, hs *HTTPServer, ids []int64, err error) {
	rsAudit := getRSDataForAudit(c, hs, ids)
	audit.RSEnableAudit(c, rsAudit, err)
}

func (hs *HTTPServer) EnableRS(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.ListRS{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while enabling report scheduler", err)
	}
	query := models.EnableRS{
		Ids:        cmd.Ids,
		UserId:     c.UserID,
		OrgId:      c.OrgID,
		IsOrgAdmin: c.OrgRole == org.RoleAdmin || c.HasBHDPermission("administration.reports", "manage"),
	}
	if err := hs.sqlStore.EnableRS(c.Req.Context(), &query); err != nil {
		go EnableRSAudit(c, hs, cmd.Ids, err)
		return hs.FailResponse(err)
	}
	message := EnableOne
	bhdCode := bhdcodes.ReportEnableSuccess
	if len(cmd.Ids) > 1 {
		message = EnableMany
		bhdCode = bhdcodes.ReportsEnableSuccess
	}
	go EnableRSAudit(c, hs, cmd.Ids, nil)
	return hs.SuccessResponse(CustomResponse{Ids: cmd.Ids, Message: message, BHDCode: bhdCode})
}

func DisableRSAudit(c *contextmodel.ReqContext, hs *HTTPServer, ids []int64, err error) {
	rsAudit := getRSDataForAudit(c, hs, ids)
	audit.RSDisableAudit(c, rsAudit, err)
}

func (hs *HTTPServer) DisableRS(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.ListRS{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while disabling report scheduler", err)
	}
	query := models.DisableRS{
		Ids:        cmd.Ids,
		UserId:     c.UserID,
		OrgId:      c.OrgID,
		IsOrgAdmin: c.OrgRole == org.RoleAdmin || c.HasBHDPermission("administration.reports", "manage"),
	}
	if err := hs.sqlStore.DisableRS(c.Req.Context(), &query); err != nil {
		go DisableRSAudit(c, hs, cmd.Ids, err)
		return hs.FailResponse(err)
	}

	message := DisableOne
	bhdCode := bhdcodes.ReportDisableSuccess
	if len(cmd.Ids) > 1 {
		message = DisableMany
		bhdCode = bhdcodes.ReportsDisableSuccess
	}
	go DisableRSAudit(c, hs, cmd.Ids, nil)
	return hs.SuccessResponse(CustomResponse{Ids: cmd.Ids, Message: message, BHDCode: bhdCode})
}

func (hs *HTTPServer) ReportPDFPreview(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.RSDataPreview{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while getting preview", err)
	}
	opts := util.SanitizeOptions{
		AllowStyle: false,
	}
	cmd.Name = util.SanitizeHtml(cmd.Name, opts)
	cmd.Description = util.SanitizeHtml(cmd.Description, opts)

	cmd.OrgId = c.OrgID
	cmd.UserId = c.UserID

	body, status, err := rs.PreviewPDF(cmd)
	if err != nil {
		return response.Error(status, err.Error(), err)
	}

	headers := make(http.Header)
	headers.Set("Content-Type", "application/pdf")
	return response.CreateNormalResponse(headers, body, 200)
}

func (hs *HTTPServer) getBillingTenantEmail(ctx context.Context, orgID int64) string {
	type Result struct {
		BillingEmail string `xorm:"billing_email"`
	}
	billingEmail := make([]Result, 0)
	err := hs.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "SELECT billing_email FROM public.org WHERE id = ?"
		return sess.SQL(rawSQL, orgID).Find(&billingEmail)
	})
	if err != nil {
		hs.log.Error("Failed to get billing tenant email", "error", err.Error())
		return ""
	}
	if len(billingEmail) == 0 {
		return ""
	}
	return billingEmail[0].BillingEmail
}

func (hs *HTTPServer) ReportSendMail(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.RSDataSendMail{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while sending mail", err)
	}

	// Prevent test email when dynamic bursting is enabled
	// For regular jobs coming from job scheduler with dynamic bursting enabled, it actually comes as disabled since we set this property to false in job scheduler after expanding the recipients.
	if cmd.DynamicBursting && cmd.RecipientMode == "dynamic" {
		return response.Error(http.StatusBadRequest, "Cannot send a test email when dynamic bursting is enabled for a schedule", nil)
	}

	// Sanitize fields
	opts := util.SanitizeOptions{
		AllowStyle: false,
	}
	cmd.Name = util.SanitizeHtml(cmd.Name, opts)
	cmd.Description = util.SanitizeHtml(cmd.Description, opts)
	cmd.Subject = util.SanitizeHtml(cmd.Subject, opts)
	cmd.Message = util.SanitizeHtml(cmd.Message, util.SanitizeOptions{AllowStyle: true})
	cmd.Sender = util.SanitizeHtml(cmd.Sender, opts)

	cmd.UserId = c.UserID
	cmd.OrgId = c.OrgID

	cmd.Sender = hs.getBillingTenantEmail(c.Req.Context(), c.OrgID)

	settings, err := hs.getReportSchedulerSettings(c)
	if err == nil {
		isInternalDomain := settings.InternalDomainsOnly
		hasWhitelistedDomains := len(settings.WhitelistedDomains) > 0
		if isInternalDomain {
			validRecipients, err := external.FilterInternalUsersByEmails(c, cmd.Recipients)
			if err != nil {
				return response.Error(http.StatusBadRequest, "Domain restriction failed", err)
			}
			if len(validRecipients) != len(cmd.Recipients) {
				return response.Error(http.StatusPreconditionFailed, "Some recipients are not internal users", err)
			}
			cmd.Recipients = validRecipients
		} else if hasWhitelistedDomains {
			// check if recipients are in whitelist
			validRecipients := util.EmailDomainValidator(cmd.Recipients, settings.WhitelistedDomains)
			if len(cmd.Recipients) != len(validRecipients) {
				return response.Error(http.StatusPreconditionFailed, "Some recipients are not in whitelist", err)
			}
		}
	}

	body, err := rs.PreviewMail(cmd)
	if err != nil {
		return response.Error(500, err.Error(), err)
	}

	headers := make(http.Header)
	headers.Set("Content-Type", "application/json")
	return response.CreateNormalResponse(headers, body, 200)
}

func (hs *HTTPServer) ReportExecuteOnce(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.ListRS{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while executing report once", err)
	}
	if len(cmd.Ids) == 0 {
		return response.Error(400, "ID is not specified", nil)
	}

	query := &models.GetJobById{
		Id:         cmd.Ids[0],
		UserId:     c.UserID,
		OrgId:      c.OrgID,
		IsOrgAdmin: c.OrgRole == org.RoleAdmin || c.HasBHDPermission("administration.reports", "manage"),
	}
	result, err := hs.SelectJobById(c.Req.Context(), query)
	if err != nil {
		return response.Error(500, err.Error(), err)
	}

	billingEmail := hs.getBillingTenantEmail(c.Req.Context(), c.OrgID)

	recipients := util.SplitStr(result.Recipients)
	bccRecipients := util.SplitStr(result.BCCRecipients)

	// Parse export options from JSON string
	exportOptions := dtos.ExportOptionsDTO{}
	if result.ExportOptions != "" {
		json.Unmarshal([]byte(result.ExportOptions), &exportOptions)
	}

	payload := dtos.RSDataExecute{
		RSDataSendMail: dtos.RSDataSendMail{
			RSDataPreview: dtos.RSDataPreview{
				Id:            result.Id,
				UserId:        c.UserID,
				OrgId:         c.OrgID,
				Name:          result.Name,
				UID:           result.Uid,
				TimeRange:     result.TimeRange,
				TimeRangeTo:   result.TimeRangeTo,
				Filter:        result.Filter,
				Orientation:   result.Orientation,
				Layout:        result.Layout,
				TableScaling:  result.TableScaling,
				Variables:     &simplejson.Json{},
				Timezone:      result.Timezone,
				Description:   result.Description,
				ReportType:    result.ReportType,
				CSVDelimiter:  result.CSVDelimiter,
				ExportOptions: exportOptions,
			},
			Subject:                 result.Subject,
			Recipients:              recipients,
			BCCRecipients:           bccRecipients,
			Message:                 result.Message,
			Cron:                    result.Cron,
			CompressAttachment:      result.CompressAttachment,
			HasDateStamp:            result.HasDateStamp,
			DateStampFormat:         result.DateStampFormat,
			HasTimeStamp:            result.HasTimeStamp,
			NoDataCondition:         result.NoDataCondition,
			Sender:                  billingEmail,
			IsDynamicBccRecipients:  result.IsDynamicBccRecipients,
			RecipientMode:           result.RecipientMode,
			DynamicRecipientDashUid: result.DynamicRecipientDashUid,
			DynamicBursting:         result.DynamicBursting,
		},
		DashName:     result.DashName,
		ScheduleType: result.ScheduleType,
		ServerDir:    result.ServerDir,
		FtpConfigId:  result.FtpConfigId,
	}

	if payload.DynamicBursting {
		// We don't want a call that comes with dynamic bursting enabled. All dynamic bursting calls have to come from job scheduler. Any actual call, it creates child jobs and sends with this as false.
		return response.Error(403, "Dynamic bursting calls can only be executed via schedules", nil)
	}

	body, err := rs.ExecuteOnce(payload)
	if err != nil {
		go audit.RSRunNowAudit(c, result.Name, result.ReportType, err)
		return response.Error(500, err.Error(), err)
	}

	go audit.RSRunNowAudit(c, result.Name, result.ReportType, nil)
	headers := make(http.Header)
	headers.Set("Content-Type", "application/json")
	return response.CreateNormalResponse(headers, body, 200)
}

func (hs *HTTPServer) GetTenantUsers(c *contextmodel.ReqContext) response.Response {
	result := hs.getTenantUsers(c)
	return response.JSON(200, result)
}

// -------------- Queries Dispatchers to SQLStore -------------- //
func (hs *HTTPServer) SelectAll(ctx context.Context, query *models.GetAll) ([]*models.RSData, error) {
	if err := hs.sqlStore.GetAllRS(ctx, query); err != nil {
		return nil, err
	}
	return query.Result, nil
}
func (hs *HTTPServer) SelectById(ctx context.Context, query *models.GetById) (*models.RSData, error) {
	if err := hs.sqlStore.GetRSById(ctx, query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func (hs *HTTPServer) SelectByDashIds(ctx context.Context, query *models.GetByDashIds) ([]*models.RSData, error) {
	if err := hs.sqlStore.GetRSByDashIds(ctx, query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func (hs *HTTPServer) SelectJobById(ctx context.Context, query *models.GetJobById) (*models.ExecuteRS, error) {
	if err := hs.sqlStore.ExecuteRS(hs.DashboardService, ctx, query); err != nil {
		return nil, err
	}
	return query.Result, nil
}

func (hs *HTTPServer) InsertRSJobQueue(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.RSJobQueue{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	query := &models.InsertRSJobQueue{
		ElapsedTime: 0,
		StartedAt:   cmd.StartedAt,
		ReportId:    cmd.ReportId,
	}
	if err := hs.sqlStore.InsertRSJobQueue(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}
	return hs.SuccessResponse(CustomResponse{Id: query.Id})
}
func (hs *HTTPServer) UpdateRSJobQueue(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.RSJobQueue{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	query := &models.UpdateRSJobQueue{
		Id:          cmd.Id,
		ElapsedTime: cmd.ElapsedTime,
		FinishedAt:  cmd.FinishedAt,
	}
	if err := hs.sqlStore.UpdateRSJobQueue(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}
	return hs.SuccessResponse(CustomResponse{})
}
func (hs *HTTPServer) InsertRSJobStatus(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.RSJobStatus{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	query := &models.InsertRSJobStatus{
		JobId:       cmd.JobId,
		Status:      cmd.Status,
		Created:     time.Now().UTC(),
		Description: cmd.Description,
	}
	if err := hs.sqlStore.InsertRSJobStatus(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}
	return hs.SuccessResponse(CustomResponse{})
}

func (hs *HTTPServer) RemoveOrDisableOrgSchedules(c *contextmodel.ReqContext) response.Response {
	orgId, err := util.ParamsInt64(web.Params(c.Req)[":orgId"])
	if err != nil {
		return hs.FailResponse(models.ErrInvalidId)
	}

	isOffboarded, err := util.ParamsBool(web.Params(c.Req)[":isOffboarded"])
	if err != nil {
		return hs.FailResponse(err)
	}
	query := &models.RemoveOrDisableOrgSchedules{
		OrgId:        orgId,
		IsOffboarded: isOffboarded,
	}

	if err := hs.sqlStore.RemoveOrDisableOrgSchedules(c.Req.Context(), query); err != nil {
		if isOffboarded {
			return response.Error(500, "Failed to delete report schedules for the org.", err)
		} else {
			return response.Error(500, "Failed to disable report schedules for the org.", err)
		}
	}

	return response.JSON(200, util.DynMap{
		"message": "Report schedules deleted/disabled successfully.",
		"bhdCode": bhdcodes.ReportSchedulesDeleteDisableSuccess,
	})
}

type CustomResponse struct {
	Id      int64   `json:"id,omitempty"`
	Ids     []int64 `json:"ids,omitempty"`
	Message string  `json:"message,omitempty"`
	BHDCode string  `json:"bhdCode,omitempty"`
}

func (hs *HTTPServer) SuccessResponse(res interface{}) response.Response {
	return response.JSON(200, res)
}

func (hs *HTTPServer) FailResponse(err error) response.Response {
	switch err {
	case models.ErrReportSchedulerNotFound:
		return response.JSON(404, CustomResponse{Message: err.Error(), BHDCode: bhdcodes.ReportSchedulerNotFound})
	case models.ErrReportSchedulerListEmpty:
		return response.JSON(400, CustomResponse{Message: err.Error(), BHDCode: bhdcodes.ReportEmptySchedulerList})
	case models.ErrReportSchedulerNameExists:
		return response.JSON(400, CustomResponse{Message: err.Error(), BHDCode: bhdcodes.ReportSchedulerDuplicateName})
	case models.ErrInvalidId:
		return response.JSON(400, CustomResponse{Message: err.Error(), BHDCode: bhdcodes.ReportInvalidID})
	case models.ErrMissingData:
		return response.JSON(400, CustomResponse{Message: err.Error(), BHDCode: bhdcodes.ReportIncompleteData})
	case models.ErrReportTenantDetailsLimitReached:
		return response.JSON(400, CustomResponse{Message: err.Error(), BHDCode: bhdcodes.ReportScheduleLimitExceeded})
	case models.ErrReportTenantDetailsLimitNotFound:
		return response.JSON(404, CustomResponse{Message: err.Error(), BHDCode: bhdcodes.ReportTenantDetailsNotFound})
	default:
		return response.JSON(500, CustomResponse{Message: err.Error()})
	}
}

func (hs *HTTPServer) GetReportTenantDetails(c *contextmodel.ReqContext) response.Response {
	result, err := hs.getReportTenant(c.Req.Context(), c.OrgID)
	if err != nil {
		return hs.FailResponse(err)
	}
	return hs.SuccessResponse(result)
}

func (hs *HTTPServer) CreateOrUpdateReportTenantDetails(c *contextmodel.ReqContext) response.Response {
	cmd := dtos.ReportTenantDetails{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while updating or creating tenant details", err)
	}
	if err := hs.setReportTenantDetails(c.Req.Context(), c.OrgID, cmd); err != nil {
		return hs.FailResponse(err)
	}
	return hs.SuccessResponse(CustomResponse{Message: "Updated.", BHDCode: bhdcodes.ReportUpdated})
}

func (hs *HTTPServer) DeleteReportTenantDetails(c *contextmodel.ReqContext) response.Response {
	query := models.DeleteReportTenantDetails{
		OrgId: c.OrgID,
	}
	if err := hs.sqlStore.DeleteReportOrg(c.Req.Context(), &query); err != nil {
		return hs.FailResponse(err)
	}
	return hs.SuccessResponse(CustomResponse{Message: "Deleted.", BHDCode: bhdcodes.ReportDeleted})
}

func (hs *HTTPServer) getReportTenant(ctx context.Context, orgId int64) (*dtos.ReportTenantDetails, error) {
	query := models.GetReportTenantDetails{OrgId: orgId}
	if err := hs.sqlStore.GetReportOrg(ctx, &query); err != nil {
		return nil, err
	}
	return &dtos.ReportTenantDetails{
		Type:  query.Result.Type,
		Limit: query.Result.Limit,
	}, nil
}
func (hs *HTTPServer) getReportCountByTenantId(ctx context.Context, orgId int64) (*int64, error) {
	query := models.GetCountReportByTenant{OrgId: orgId}
	if err := hs.sqlStore.CountReportsByTenant(ctx, &query); err != nil {
		return nil, err
	}
	return query.Result, nil
}
func (hs *HTTPServer) setReportTenantDetails(ctx context.Context, orgId int64, reportDetails dtos.ReportTenantDetails) error {
	query := models.CreateOrUpdateReportTenantDetails{
		OrgId: orgId,
		ReportTenantDetails: models.ReportTenantDetails{
			Type:  reportDetails.Type,
			Limit: reportDetails.Limit,
		},
	}
	return hs.sqlStore.CreateOrUpdateReportOrg(ctx, &query)
}
func (hs *HTTPServer) checkReportLimitReached(ctx context.Context, orgId int64) error {
	var err error
	var reportCount *int64
	tenantDetails := &dtos.TenantDetails{}
	reportTenantDetails := &dtos.ReportTenantDetails{}

	// Get tenant details
	if reportTenantDetails, err = hs.getReportTenant(ctx, orgId); err != nil {

		if !errors.Is(err, models.ErrReportTenantDetailsLimitNotFound) {
			return err
		}

		// Get tenant details from TMS api
		hs.log.Info("Getting tenant details from TMS api")
		if tenantDetails, err = rs.GetTenantDetails(orgId); err != nil {
			return err
		}
		// Populate report tenant details when there is no record in database
		// with default value.
		tenantType := tenantDetails.Type
		tenantReportLimit := setting.ReportSchedulerLicenseDefaultLimit
		if tenantType == "TRIAL" {
			tenantReportLimit = setting.ReportSchedulerTrialDefaultLimit
		}
		reportTenantDetails = &dtos.ReportTenantDetails{
			Type:  tenantType,
			Limit: tenantReportLimit,
		}
		if err = hs.setReportTenantDetails(ctx, orgId, *reportTenantDetails); err != nil {
			return err
		}
	}

	// Get report count for current user tenant
	if reportCount, err = hs.getReportCountByTenantId(ctx, orgId); err != nil {
		return err
	}

	// Compare report count with report tenant detail limit
	if *reportCount >= int64(reportTenantDetails.Limit) {
		return models.ErrReportTenantDetailsLimitReached
	}

	return nil
}
func (hs *HTTPServer) getEmailDomainRestrictions(c *contextmodel.ReqContext) ([]string, bool) {
	settings, err := hs.getReportSchedulerSettings(c)
	if err != nil {
		return []string{}, false
	}
	return settings.WhitelistedDomains, !settings.InternalDomainsOnly && len(settings.WhitelistedDomains) > 0
}
