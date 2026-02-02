package api

import (
	"encoding/base64"
	"errors"

	"github.com/grafana/grafana/pkg/bhdcodes"
	kp "github.com/grafana/grafana/pkg/bmc/kafkaproducer"

	"net/http"
	"net/url"
	"strconv"
	"strings"

	"time"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	goval "github.com/asaskevich/govalidator"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bmc/ftp"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func init() {
	goval.SetFieldsRequiredByDefault(true)
}

func (hs *HTTPServer) GetFTPConfig(c *contextmodel.ReqContext) response.Response {
	query := &models.GetFTPConfigs{
		OrgId: c.OrgID,
	}
	if err := hs.sqlStore.GetFTPConfigs(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}
	return hs.SuccessResponse(query.Result)
}

func (hs *HTTPServer) SetFTPConfig(c *contextmodel.ReqContext) response.Response {
	cmd := &models.SetFTPConfigCmd{}
	if err := web.Bind(c.Req, cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request payload while setting FTP configuration", err)
	}

	cmd.OrgID = c.OrgID
	if err := PingFTP(&models.ModifyFTPConfigCmd{
		Host:     cmd.Host,
		Port:     cmd.Port,
		Username: cmd.Username,
		Password: cmd.Password,
	}); err != nil {
		kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to connect to FTP server: " + err.Error()})
		return response.Error(http.StatusBadGateway, "Failed to connect to FTP server", err)
	}

	if err := hs.sqlStore.SetFTPConfig(c.Req.Context(), cmd); err != nil {
		if strings.Contains(err.Error(), "duplicate key value violates unique constraint") {
			kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "FTP Configuration already exist: " + err.Error()})
			return response.Error(500, "FTP Configuration already exist", err)
		} else {
			kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to Add FTP Configuration: " + err.Error()})
			return response.Error(500, "Failed to Add FTP Configuration", err)
		}

	}
	newValue := &models.ModifyFTPConfigCmd{
		Host:     cmd.Host,
		Port:     cmd.Port,
		Username: cmd.Username,
		OrgID:    cmd.OrgID,
	}
	kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, New: newValue, OperationSubType: "FTP configuration saved successfully"})
	return response.JSON(200, &util.DynMap{"message": "FTP configuration saved successfully", "bhdCode": bhdcodes.FTPConfigSaveSuccess})

}

func (hs *HTTPServer) SetDefaultFTPConfig(c *contextmodel.ReqContext) response.Response {
	cmd := &models.SetDefaultFTPConfigCmd{}
	if err := web.Bind(c.Req, cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request payload while setting default FTP configuration", err)
	}

	preValue := &models.GetFTPConfig{
		OrgId: c.OrgID,
		Id:    cmd.Id,
	}
	if err := hs.sqlStore.GetFTPConfig(c.Req.Context(), preValue); err != nil {
		logger.Error("Failed to get previous FTP configuration")
		return response.Error(http.StatusRequestTimeout, "Failed to get previous FTP configuration", err)
	}

	cmd.OrgID = c.OrgID

	if err := hs.sqlStore.SetDefaultFTPConfig(c.Req.Context(), cmd); err != nil {
		logger.Info("SetDefaultFTPConfig failed ", "tenantId:", c.OrgID)
		kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to Update FTP Configuration: " + err.Error()})
		return response.Error(500, "Failed to Update FTP Configuration", err)
	}

	newValueDetails := &models.ModifyFTPConfigCmd{
		Host:      preValue.Result.Host,
		Port:      preValue.Result.Port,
		Username:  preValue.Result.Username,
		Id:        preValue.Result.Id,
		OrgID:     preValue.Result.OrgID,
		IsDefault: true,
	}
	kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, New: newValueDetails, OperationSubType: "FTP configured as default"})
	return response.JSON(200, &util.DynMap{"message": "FTP configured as default", "bhdCode": bhdcodes.FTPConfiguredAsDefault})

}

func (hs *HTTPServer) ModifyFTPConfig(c *contextmodel.ReqContext) response.Response {

	cmd := &models.ModifyFTPConfigCmd{}
	if err := web.Bind(c.Req, cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request payload while modifying FTP configurations", err)
	}

	preValue := &models.GetFTPConfig{
		OrgId: c.OrgID,
		Id:    cmd.Id,
	}
	if err := hs.sqlStore.GetFTPConfig(c.Req.Context(), preValue); err != nil {
		logger.Error("Failed to get previous FTP configuration")
		return response.Error(http.StatusRequestTimeout, "Failed to get previous FTP configuration", err)
	}

	cmd.OrgID = c.OrgID
	if err := PingFTP(cmd); err != nil {
		kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to connect to FTP server: " + err.Error()})
		return response.Error(http.StatusRequestTimeout, "Failed to connect to FTP server", err)
	}

	if err := hs.sqlStore.ModifyFTPConfig(c.Req.Context(), cmd); err != nil {
		kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to update FTP configuration with error: " + err.Error()})
		return response.Error(http.StatusInternalServerError, "Failed to Update FTP Configuration", err)
	}

	newValue := &models.GetFTPConfig{
		OrgId: c.OrgID,
	}
	if err := hs.sqlStore.GetFTPConfig(c.Req.Context(), newValue); err != nil {
		logger.Error("Failed to get updated FTP configuration")
	}

	updatedValue := &models.ModifyFTPConfigCmd{
		Host:     cmd.Host,
		Port:     cmd.Port,
		Username: cmd.Username,
		Id:       cmd.Id,
		OrgID:    cmd.OrgID,
	}
	oldValueDetails := &models.ModifyFTPConfigCmd{
		Host:     preValue.Result.Host,
		Port:     preValue.Result.Port,
		Username: preValue.Result.Username,
		Id:       preValue.Result.Id,
		OrgID:    preValue.Result.OrgID,
	}
	kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, Prev: oldValueDetails, New: updatedValue, OperationSubType: "FTP configuration updated successfully"})
	return response.JSON(http.StatusOK, &util.DynMap{"message": "FTP configuration updated successfully", "bhdCode": bhdcodes.FTPConfigUpdateSuccess})
}

func PingFTP(cmd *models.ModifyFTPConfigCmd) error {

	parsedUrl, err := url.Parse(cmd.Host)
	if err != nil {
		return errors.New("Failed to parse FTP URL")
	}

	//IP Address Check for host name field
	if goval.IsIP(parsedUrl.Host) {
		return errors.New("Validation Error: IP Address is not allowed as server host")
	}

	// connectivity validation
	decodedPwd, err := base64.StdEncoding.DecodeString(cmd.Password)
	if err != nil {
		logger.Info("Error occurred while retrieving FTP user details", err.Error())
		return errors.New("Error occurred while retrieving FTP user details")
	}

	scheme := "ftp"
	if parsedUrl.Scheme == "sftp" {
		scheme = parsedUrl.Scheme
	}

	config := ftp.ConnConfig{
		Protocol:      scheme,
		Host:          parsedUrl.Host,
		Port:          cmd.Port,
		User:          cmd.Username,
		Password:      string(decodedPwd),
		Timeout:       60 * time.Second,
		IgnoreHostKey: true,
	}
	instance, err := ftp.NewInstance(config)
	if err != nil {
		return err
	}
	defer instance.Close()

	if err := instance.Ping(); err != nil {
		return err
	}

	return nil
}

func (hs *HTTPServer) DeleteFTPConfig(c *contextmodel.ReqContext) response.Response {
	id, err := util.ParamsInt64(web.Params(c.Req)[":id"])
	if err != nil {
		return hs.FailResponse(models.ErrInvalidId)
	}

	preValue := &models.GetFTPConfig{
		Id: id,
	}
	if err := hs.sqlStore.GetFTPConfig(c.Req.Context(), preValue); err != nil {
		logger.Error("Failed to get previous FTP configuration")
		return response.Error(http.StatusRequestTimeout, "Failed to get previous FTP configuration", err)
	}

	query := &models.IsDefaultFTPConfig{
		FtpConfigId: id,
	}
	if err := hs.sqlStore.IsDefaultFtpConfig(c.Req.Context(), query); err != nil {
		return hs.FailResponse(err)
	}

	if query.Result != nil {
		return response.Error(http.StatusInternalServerError, "Default FTP configuration deletion is not allowed!", nil)
	}
	configQuery := &models.GetReportByFtpConfig{
		FtpConfigId: strconv.FormatInt(id, 10),
	}

	if err := hs.sqlStore.GetReportByFtpConfig(c.Req.Context(), configQuery); err != nil {
		return hs.FailResponse(err)
	}

	if configQuery.Result != nil {
		logger.Info("FTP is used in report scheduler", "tenantId:", c.OrgID, "Id:", id)
		return response.Error(http.StatusInternalServerError, "FTP is used in report scheduler", nil)
	}
	if err := hs.sqlStore.DeleteFTPConfig(c.Req.Context(), id, c.OrgID); err != nil {
		kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to delete FTP configuration with error: " + err.Error()})
		return response.Error(http.StatusInternalServerError, "Failed to delete FTP configuration", err)
	}

	oldValueDetails := &models.ModifyFTPConfigCmd{
		Host:     preValue.Result.Host,
		Port:     preValue.Result.Port,
		Username: preValue.Result.Username,
		Id:       preValue.Result.Id,
		OrgID:    preValue.Result.OrgID,
	}

	kp.ReportFtpSettingsEvent.Send(kp.EventOpt{Ctx: c, New: oldValueDetails, OperationSubType: "FTP configuration deleted successfully"})
	return response.JSON(http.StatusOK, &util.DynMap{"message": "FTP configuration deleted successfully", "bhdCode": bhdcodes.FTPConfigDeleteSuccess})
}
