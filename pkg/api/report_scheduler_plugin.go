package api

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/grafana/grafana/pkg/bhdcodes"
	"github.com/grafana/grafana/pkg/bmc/audit"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"errors"
	"net/http"
	"os"
	"time"

	utils "github.com/grafana/grafana/pkg/api/bmc"
	"github.com/grafana/grafana/pkg/api/bmc/external"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bmc"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetAllReports(ctx *contextmodel.ReqContext) response.Response {
	query := &bmc.GetAllReports{
		QueryName: ctx.Query("query"),
		Auth: bmc.Auth{
			UserID:      ctx.UserID,
			OrgID:       ctx.OrgID,
			IsOrgAdmin:  ctx.OrgRole == org.RoleAdmin || ctx.HasBHDPermission("administration.reports", "manage"),
			IsSuperUser: ctx.IsGrafanaAdmin,
		},
	}

	if err := hs.sqlStore.GetAllReports(ctx.Req.Context(), query); err != nil {
		return response.Error(500, "Failed to fetch reports", err)
	}

	reports := make([]bmc.ReportsResponse, 0)
	for _, report := range query.Result {
		response := bmc.ReportModelToDTO(report)
		cleanRecipientsList(&response)
		reports = append(reports, response)
	}

	return response.JSON(200, reports)
}

func (hs *HTTPServer) GetReportByID(ctx *contextmodel.ReqContext) response.Response {
	id, _ := util.ParamsInt64(web.Params(ctx.Req)[":id"])
	query := &bmc.GetReportByID{
		ID: id,
		Auth: bmc.Auth{
			UserID:      ctx.UserID,
			OrgID:       ctx.OrgID,
			IsOrgAdmin:  ctx.OrgRole == org.RoleAdmin || ctx.HasBHDPermission("administration.reports", "manage"),
			IsSuperUser: ctx.IsGrafanaAdmin,
		},
	}

	if err := hs.sqlStore.GetReportByID(ctx.Req.Context(), query); err != nil {
		return response.JSON(500, err)
	}

	report := bmc.ReportModelToDTO(query.Result)
	cleanRecipientsList(&report)
	return response.JSON(200, report)
}

func cleanRecipientsList(report *bmc.ReportsResponse) {
	if len(report.Share.Recipients) == 1 && report.Share.Recipients[0] == "" {
		report.Share.Recipients = make([]string, 0)
	}
	if len(report.Share.BCCRecipients) == 1 && report.Share.BCCRecipients[0] == "" {
		report.Share.BCCRecipients = make([]string, 0)
	}
}

func (hs *HTTPServer) CreateReport(ctx *contextmodel.ReqContext) response.Response {
	payload := bmc.CreateReport{}
	if err := web.Bind(ctx.Req, &payload); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while creating a report", err)
	}

	if err := hs.checkReportLimitReached(ctx.Req.Context(), ctx.OrgID); err != nil {
		return hs.FailResponse(err)
	}

	if payload.ScheduleType != "ftp" {
		if len(payload.Recipients) == 0 && len(payload.BCCRecipients) == 0 && payload.DynamicRecipientDashId == 0 {
			return response.Error(400, "Recipients are required", nil)
		}

		if err := hs.validateDynamicBursting(&payload); err != nil {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}

		settings, err := hs.getReportSchedulerSettings(ctx)
		if err == nil {
			isInternalDomain := settings.InternalDomainsOnly
			hasWhitelistedDomains := len(settings.WhitelistedDomains) > 0
			if isInternalDomain {
				validRecipients, err := external.FilterInternalUsersByEmails(ctx, payload.Recipients)
				if err != nil {
					return response.Error(http.StatusBadRequest, "Domain restriction failed", err)
				}

				err = hs.validateRecipients(validRecipients, payload.Recipients)
				if err != nil {
					return response.Error(http.StatusPreconditionFailed, "Some recipients are not internal users", err)
				}
				payload.Recipients = validRecipients

				validBCCRecipients, err := external.FilterInternalUsersByEmails(ctx, payload.BCCRecipients)
				if err != nil {
					return response.Error(http.StatusBadRequest, "Domain restriction failed", err)
				}

				err = hs.validateRecipients(validBCCRecipients, payload.BCCRecipients)
				if err != nil {
					return response.Error(http.StatusPreconditionFailed, "Some BCC recipients are not internal users", err)
				}
				payload.BCCRecipients = validBCCRecipients
			} else if hasWhitelistedDomains {
				// check if recipients are in whitelist
				validRecipients := util.EmailDomainValidator(payload.Recipients, settings.WhitelistedDomains)
				if len(payload.Recipients) != len(validRecipients) {
					return response.Error(http.StatusPreconditionFailed, "Some recipients are not in whitelist", err)
				}

				// check if BCC recipients are in whitelist
				validRecipients = util.EmailDomainValidator(payload.BCCRecipients, settings.WhitelistedDomains)
				if len(payload.BCCRecipients) != len(validRecipients) {
					return response.Error(http.StatusPreconditionFailed, "Some BCC recipients are not in whitelist", err)
				}
			}
		}
		if err != nil {
			hs.log.Warn("Failed to get report scheduler settings", "error", err)
		}
	}
	opts := util.SanitizeOptions{
		AllowStyle: false,
	}
	payload.Name = util.SanitizeHtml(payload.Name, opts)
	payload.Description = util.SanitizeHtml(payload.Description, opts)
	payload.Subject = util.SanitizeHtml(payload.Subject, opts)
	payload.Message = util.SanitizeHtml(payload.Message, util.SanitizeOptions{AllowStyle: true})

	payload.DateStampFormat = util.ValidateDateFormat(payload.DateStampFormat)

	nextAt, err := util.GetNextAt(payload.Cron, payload.Timezone)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Invalid cron expression", err)
	}

	optsJSON, err := json.Marshal(payload.ExportOptions)

	report := &models.InsertRS{
		Data: models.InsertRSData{
			Name:                   payload.Name,
			Description:            payload.Description,
			DashboardId:            payload.DashboardId,
			TimeRange:              payload.TimeRange,
			TimeRangeTo:            payload.TimeRangeTo,
			Filter:                 payload.Filter,
			ReplyTo:                payload.ReplyTo,
			Subject:                payload.Subject,
			Recipients:             util.JoinStr(payload.Recipients),
			BCCRecipients:          util.JoinStr(payload.BCCRecipients),
			Message:                payload.Message,
			Orientation:            payload.Orientation,
			Layout:                 payload.Layout,
			TableScaling:           payload.TableScaling,
			Enabled:                payload.Enabled,
			CreatedAt:              time.Now().UTC(),
			UpdatedAt:              time.Now().UTC(),
			NextAt:                 nextAt.Unix(),
			ReportType:             payload.ReportType,
			ScheduleType:           payload.ScheduleType,
			ServerDir:              payload.ServerDir,
			HasDateStamp:           payload.HasDateStamp,
			HasTimeStamp:           payload.HasTimeStamp,
			NoDataCondition:        payload.NoDataCondition,
			UserId:                 ctx.UserID,
			OrgId:                  ctx.OrgID,
			CompressAttachment:     payload.CompressAttachment,
			CSVDelimiter:           payload.CSVDelimiter,
			ExportOptions:          string(optsJSON),
			ReportFftpConfigId:     payload.FtpConfigId,
			IsDynamicBccRecipients: payload.IsDynamicBccRecipients,
			RecipientMode:          payload.RecipientMode,
			DynamicRecipientDashId: payload.DynamicRecipientDashId,
			DynamicBursting:        payload.DynamicBursting,
			DateStampFormat:        payload.DateStampFormat,
		},
		Scheduler: models.InsertRScheduler{
			Timezone: payload.Timezone,
			Cron:     payload.Cron,
		},
	}

	if err != nil {
		return hs.FailResponse(err)
	}
	query := report

	if err := hs.sqlStore.InsertRS(ctx.Req.Context(), query); err != nil {
		go audit.RSCreateAudit(ctx, query, err)
		return hs.FailResponse(err)
	}

	go audit.RSCreateAudit(ctx, query, nil)
	return hs.SuccessResponse(CustomResponse{Id: query.Data.Id, Message: Created, BHDCode: bhdcodes.ReportCreateSuccess})
}

func (hs *HTTPServer) UpdateReport(ctx *contextmodel.ReqContext) response.Response {
	payload := bmc.UpdateReport{}
	if err := web.Bind(ctx.Req, &payload); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data while updating report", err)
	}
	if payload.Id == 0 {
		payload.Id, _ = util.ParamsInt64(web.Params(ctx.Req)[":id"])
	}
	if payload.Id == 0 {
		return response.Error(http.StatusBadRequest, "Invalid report id", nil)
	}

	if payload.ScheduleType != "ftp" {
		if len(payload.Recipients) == 0 && len(payload.BCCRecipients) == 0 && payload.DynamicRecipientDashId == 0 {
			return response.Error(400, "Recipients are required", nil)
		}

		if err := hs.validateDynamicBursting(&payload.CreateReport); err != nil {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}

		settings, err := hs.getReportSchedulerSettings(ctx)
		if err == nil {
			isInternalDomain := settings.InternalDomainsOnly
			hasWhitelistedDomains := len(settings.WhitelistedDomains) > 0
			if isInternalDomain {
				validRecipients, err := external.FilterInternalUsersByEmails(ctx, payload.Recipients)
				if err != nil {
					return response.Error(http.StatusBadRequest, "Restriction of internal domains only failed", err)
				}
				err = hs.validateRecipients(validRecipients, payload.Recipients)
				if err != nil {
					return response.Error(http.StatusPreconditionFailed, "Some recipients are not internal users", err)
				}
				payload.Recipients = validRecipients
				validBCCRecipients, err := external.FilterInternalUsersByEmails(ctx, payload.BCCRecipients)
				if err != nil {
					return response.Error(http.StatusBadRequest, "Domain restriction failed", err)
				}
				err = hs.validateRecipients(validBCCRecipients, payload.BCCRecipients)
				if err != nil {
					return response.Error(http.StatusPreconditionFailed, "Some BCC recipients are not internal users", err)
				}
				payload.BCCRecipients = validBCCRecipients
			} else if hasWhitelistedDomains {
				// check if recipients are in whitelist
				validRecipients := util.EmailDomainValidator(payload.Recipients, settings.WhitelistedDomains)
				if len(payload.Recipients) != len(validRecipients) {
					return response.Error(http.StatusPreconditionFailed, "Some recipients are not in whitelist", err)
				}

				// check if BCC recipients are in whitelist
				validRecipients = util.EmailDomainValidator(payload.BCCRecipients, settings.WhitelistedDomains)
				if len(payload.BCCRecipients) != len(validRecipients) {
					return response.Error(http.StatusPreconditionFailed, "Some BCC recipients are not in whitelist", err)
				}
			}
		}
		if err != nil {
			hs.log.Warn("Failed to get report scheduler settings", "error", err)
		}
	}

	payload.DateStampFormat = util.ValidateDateFormat(payload.DateStampFormat)

	nextAt, err := util.GetNextAt(payload.Cron, payload.Timezone)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Invalid cron expression", err)
	}

	opts := util.SanitizeOptions{
		AllowStyle: false,
	}

	optsJSON, err := json.Marshal(payload.ExportOptions)

	report := &models.UpdateRS{
		Data: models.UpdateRSData{
			Id:                     payload.Id,
			OrgId:                  ctx.OrgID,
			Name:                   util.SanitizeHtml(payload.Name, opts),
			Description:            util.SanitizeHtml(payload.Description, opts),
			DashboardId:            payload.DashboardId,
			TimeRange:              payload.TimeRange,
			TimeRangeTo:            payload.TimeRangeTo,
			Filter:                 payload.Filter,
			ReplyTo:                payload.ReplyTo,
			Subject:                util.SanitizeHtml(payload.Subject, opts),
			Recipients:             util.JoinStr(payload.Recipients),
			BCCRecipients:          util.JoinStr(payload.BCCRecipients),
			Message:                util.SanitizeHtml(payload.Message, util.SanitizeOptions{AllowStyle: true}),
			Orientation:            payload.Orientation,
			Layout:                 payload.Layout,
			TableScaling:           payload.TableScaling,
			Enabled:                payload.Enabled,
			UpdatedAt:              time.Now().UTC(),
			NextAt:                 nextAt.Unix(),
			ReportType:             payload.ReportType,
			ScheduleType:           payload.ScheduleType,
			ServerDir:              payload.ServerDir,
			HasDateStamp:           payload.HasDateStamp,
			DateStampFormat:        payload.DateStampFormat,
			HasTimeStamp:           payload.HasTimeStamp,
			NoDataCondition:        payload.NoDataCondition,
			CompressAttachment:     payload.CompressAttachment,
			CSVDelimiter:           payload.CSVDelimiter,
			ExportOptions:          string(optsJSON),
			ReportFftpConfigId:     payload.FtpConfigId,
			IsDynamicBccRecipients: payload.IsDynamicBccRecipients,
			RecipientMode:          payload.RecipientMode,
			DynamicRecipientDashId: &payload.DynamicRecipientDashId,
			DynamicBursting:        payload.DynamicBursting,
		},
		UserId: ctx.UserID,
		Scheduler: models.InsertRScheduler{
			StartFrom: payload.StartFrom,
			EndAt:     payload.EndAt,
			Timezone:  payload.Timezone,
			Cron:      payload.Cron,
		},
		IsOrgAdmin: ctx.OrgRole == org.RoleAdmin || ctx.HasBHDPermission("administration.reports", "manage"),
	}
	if err != nil {
		return hs.FailResponse(err)
	}

	query := report

	if err := hs.sqlStore.UpdateRS(ctx.Req.Context(), query); err != nil {
		go audit.RSUpdateAudit(ctx, query, err)
		return hs.FailResponse(err)
	}

	go audit.RSUpdateAudit(ctx, query, nil)
	logger.Info("Report Update", "Report_ID", query.Data.Id, "Report_Name", query.Data.Name, "Org_ID", ctx.OrgID, "Updated_by", ctx.UserID)
	return hs.SuccessResponse(CustomResponse{Id: query.Data.Id, Message: Updated, BHDCode: bhdcodes.ReportUpdateSuccess})
}

func (hs *HTTPServer) DeleteReport(ctx *contextmodel.ReqContext) response.Response {
	paramsIds := ctx.QueryStrings("id")
	ids := utils.StrToInt64s(paramsIds)
	if len(ids) == 0 {
		return response.Error(http.StatusBadRequest, "No reports to delete", nil)
	}

	query := models.DeleteRS{
		Ids:        ids,
		UserId:     ctx.UserID,
		OrgId:      ctx.OrgID,
		IsOrgAdmin: ctx.OrgRole == org.RoleAdmin || ctx.HasBHDPermission("administration.reports", "manage"),
	}

	// Get the report scheduler details for audit
	rsAudit := getRSDataForAudit(ctx, hs, ids)

	if err := hs.sqlStore.DeleteRS(ctx.Req.Context(), &query); err != nil {
		go audit.RSDeleteAudit(ctx, rsAudit, err)
		return hs.FailResponse(err)
	}

	message := DeletedOne
	bhdCode := bhdcodes.ReportDeleteSuccess
	if len(ids) > 1 {
		message = DeletedMany
		bhdCode = bhdcodes.ReportsDeleteSuccess
	}
	go audit.RSDeleteAudit(ctx, rsAudit, nil)
	return response.SuccessWithBHDCode(message, bhdCode)
}

func (hs *HTTPServer) DeleteUserFromReports(ctx *contextmodel.ReqContext) response.Response {
	tenantID := ctx.QueryInt64("tenant_id")
	userID := ctx.QueryInt64("user_id")
	emailID := ctx.Query("email_id")
	hardDelete := ctx.QueryBoolWithDefault("hard_delete", false)
	query := models.DeleteUserFromRS{
		OrgId:      tenantID,
		UserId:     userID,
		EmailId:    emailID,
		HardDelete: hardDelete,
	}
	if err := hs.sqlStore.DeleteUserFromRS(ctx.Req.Context(), &query); err != nil {
		return hs.FailResponse(err)
	}
	return response.Success("Successfully deleted user from reports.")
}

// Utility function to create tlsClient

func createTlsClient(path string) (*http.Client, error) {
	caCert, err := ioutil.ReadFile(path)
	if err != nil {
		return http.DefaultClient, err
	}
	caCertPool := x509.NewCertPool()
	caCertPool.AppendCertsFromPEM(caCert)

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			RootCAs: caCertPool,
		},
	}

	tlsClient := &http.Client{Transport: tr}
	return tlsClient, nil
}

func (hs *HTTPServer) GetReportJobByID(ctx *contextmodel.ReqContext) response.Response {
	jobID, err := util.ParamsInt64(web.Params(ctx.Req)[":id"])
	if err != nil {
		return response.Error(400, "Invalid job id", err)
	}
	query := &bmc.GetReportJobQueue{
		JobID: jobID,
		OrgID: ctx.OrgID,
	}
	hs.log.Info("GetReportJobByID", "jobID", query.JobID, "orgID", query.OrgID)
	if err := hs.sqlStore.GetReportJobQueue(ctx.Req.Context(), query); err != nil {
		return response.Error(500, err.Error(), err)
	}

	if query.Result.FileKey == "" {
		return response.Error(http.StatusNotFound, "Report is not in storage", err)
	}

	storageBucketName := os.Getenv("AWS_BUCKET_NAME")
	accessKeyID := os.Getenv("AWS_ACCESS_KEY_ID")
	secretAccessKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	endpoint := os.Getenv("AWS_ENDPOINT")
	region := os.Getenv("AWS_REGION")
	certsEnabled := false
	if strings.EqualFold(os.Getenv("AWS_CERTS_ENABLED"), "true") {
		certsEnabled = true
	}
	certsPath := os.Getenv("AWS_ON_PREM_CERT_PATH")
	tlsHttpClient := http.DefaultClient
	if certsEnabled {
		var err error
		tlsHttpClient, err = createTlsClient(certsPath)
		if err != nil {
			hs.log.Error(fmt.Sprintf("Failed to create TLS transport to enable SSL validation for S3: %v", err))
		}
	}

	client, err := session.NewSession(&aws.Config{
		Credentials: credentials.NewStaticCredentialsFromCreds(credentials.Value{
			AccessKeyID:     accessKeyID,
			SecretAccessKey: secretAccessKey,
		}),
		Endpoint:         aws.String(endpoint),
		Region:           aws.String(region),
		S3ForcePathStyle: aws.Bool(true),
		// default value of http client is http.defaultClient
		HTTPClient: tlsHttpClient,
	})
	if err != nil {
		return hs.FailResponse(err)
	}

	svc := s3.New(client)

	// check if file with version exist
	hs.log.Info("Checking if file with version exists")
	if _, err := svc.HeadObject(&s3.HeadObjectInput{
		Bucket:    aws.String(storageBucketName),
		VersionId: aws.String(query.Result.FileVersion),
		Key:       aws.String(query.Result.FileKey),
	}); err != nil {
		hs.log.Info("File with version does not exist", "error", err)
		return response.Error(404, "File is not available on storage", err)
	}

	req, _ := svc.GetObjectRequest(&s3.GetObjectInput{
		Bucket:    aws.String(storageBucketName),
		VersionId: aws.String(query.Result.FileVersion),
		Key:       aws.String(query.Result.FileKey),
	})

	preSignedURL, err := req.Presign(1 * time.Minute)

	return response.Success(preSignedURL)
}

func (hs *HTTPServer) validateRecipients(validRecipients, payloadRecipients []string) error {
	// Condition 1: Check length
	if len(validRecipients) < len(payloadRecipients) {
		return errors.New("Some recipients are not in whitelist")
	}

	// Create a map for faster lookup
	validMap := make(map[string]bool)
	for _, r := range validRecipients {
		validMap[r] = true
	}

	// Condition 2: Ensure all payload recipients are in validRecipients
	for _, r := range payloadRecipients {
		if !validMap[r] {
			return errors.New("Some recipients are not in whitelist")
		}
	}

	return nil
}

// Validation of reports where dynamic bursting is enabled
func (hs *HTTPServer) validateDynamicBursting(payload *bmc.CreateReport) error {
	var err error
	if payload.DynamicBursting {
		if payload.DynamicRecipientDashId == 0 {
			err = errors.New("Dynamic recipient dashboard id is required for dynamic bursting")
		} else if payload.IsDynamicBccRecipients {
			err = errors.New("BCC Recipients are not allowed in dynamic bursting")
		} else {
			// Validate that cron hours field contains only a single integer
			cronParts := strings.Fields(payload.Cron)
			if len(cronParts) >= 2 {
				hoursField := cronParts[1]
				// Verify it's a valid integer
				if _, parseErr := strconv.Atoi(hoursField); parseErr != nil {
					err = errors.New("Dynamic bursting requires a valid single hour value in cron expression")
				}
			}
		}
	}
	if err != nil {
		hs.log.Error("Dynamic bursting validation failed", "dashboardId", payload.DashboardId, "name", payload.Name, "error", err)
	}
	return err
}

func (hs *HTTPServer) GetReportUsers(ctx *contextmodel.ReqContext) response.Response {
	query := models.GetReportUsers{
		OrgId: ctx.OrgID,
	}

	MspTeamIdStr := ctx.Query("mspTeamId")
	if MspTeamIdStr != "" {
		query.MspTeamId, _ = strconv.ParseInt(MspTeamIdStr, 10, 64)
	}

	if err := hs.sqlStore.GetReportUsers(ctx.Req.Context(), &query); err != nil {
		return response.JSON(500, err)
	}

	return response.JSON(200, query.Result)
}

func (hs *HTTPServer) GetReportOwners(ctx *contextmodel.ReqContext) response.Response {
	query := models.GetReportUsers{
		OrgId: ctx.OrgID,
	}

	MspTeamIdStr := ctx.Query("mspTeamId")
	if MspTeamIdStr != "" {
		query.MspTeamId, _ = strconv.ParseInt(MspTeamIdStr, 10, 64)
	}

	if err := hs.sqlStore.GetReportOwners(ctx.Req.Context(), &query); err != nil {
		return response.JSON(500, err)
	}

	return response.JSON(200, query.Result)
}

func (hs *HTTPServer) UpdateReportsOwner(ctx *contextmodel.ReqContext) response.Response {
	ownerId, _ := util.ParamsInt64(web.Params(ctx.Req)[":id"])
	query := models.UpdateRSOwner{}
	if err := web.Bind(ctx.Req, &query); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if len(query.Ids) == 0 {
		return response.Error(http.StatusBadRequest, "bad request data", nil)
	}
	query.OrgId = ctx.OrgID
	query.OwnerId = ownerId

	if err := hs.sqlStore.UpdateReportsOwner(ctx.Req.Context(), &query); err != nil {
		return response.JSON(500, err)
	}
	go UpdateReportsOwnerAudit(ctx, hs, query, nil)
	return hs.SuccessResponse(CustomResponse{Ids: query.Ids, Message: "Reports owner updated successfully", BHDCode: bhdcodes.ReportOwnerUpdatedSuccess})
}

func UpdateReportsOwnerAudit(c *contextmodel.ReqContext, hs *HTTPServer, query models.UpdateRSOwner, err error) {
	rsAudit := getRSDataForAudit(c, hs, query.Ids)
	audit.RSUpdateOwnerAudit(c, rsAudit, query, err)
}

func (hs *HTTPServer) GetReportsByOwnerID(ctx *contextmodel.ReqContext) response.Response {
	id, _ := util.ParamsInt64(web.Params(ctx.Req)[":id"])
	query := &bmc.GetAllReports{
		QueryName: ctx.Query("query"),
		Auth: bmc.Auth{
			UserID: id,
			OrgID:  ctx.OrgID,
		},
	}

	if err := hs.sqlStore.GetAllReports(ctx.Req.Context(), query); err != nil {
		return response.JSON(500, err)
	}

	reports := make([]bmc.ReportsResponse, 0)
	for _, report := range query.Result {
		reports = append(reports, bmc.ReportModelToDTO(report))
	}

	return response.JSON(200, reports)
}
