package reporting_scheduler

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrSchedulerServiceUrlNotProvided       = errors.New("Reporting scheduler is not configured")
	ErrSchedulerServiceUrlNotReachable      = errors.New("Failed to reach reporting service")
	ErrSchedulerServiceFailedToPreviewPDF   = errors.New("Failed to generate report")
	ErrSchedulerServiceFailedToSendTestMail = errors.New("Failed to send test email")
	ErrSchedulerServiceFailedToExecuteOnce  = errors.New("Failed to run once")
)

var logger = log.New("report_scheduler")

func PreviewPDF(data dtos.RSDataPreview) ([]byte, int, error) {
	logger.Info("Running preview PDF",
		"orgId", data.OrgId,
		"userId", data.UserId,
		"dashboard", data.UID,
		"report", data.Name,
		"url", setting.ReportingServerURL+setting.ReportingServerPDFEndPoint,
	)

	if setting.ReportingServerURL == "" {
		return nil, 500, ErrSchedulerServiceUrlNotProvided
	}

	b, err := json.Marshal(data)
	if err != nil {
		return nil, 500, err
	}

	url := setting.ReportingServerURL + setting.ReportingServerPDFEndPoint
	payload := strings.NewReader(string(b))
	method := "POST"

	client := &http.Client{}
	req, err := http.NewRequest(method, url, payload)
	if err != nil {
		logger.Error(err.Error())
		return nil, 500, err
	}
	req.Header.Add("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		logger.Error(err.Error())
		return nil, 500, ErrSchedulerServiceUrlNotReachable
	}
	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)

	if err != nil {
		logger.Error(err.Error())
		return nil, 500, ErrSchedulerServiceFailedToPreviewPDF
	}

	if res.StatusCode != 200 {
		logger.Error("Failed", "status", res.Status)
		return nil, res.StatusCode, ErrSchedulerServiceFailedToPreviewPDF
	}

	return body, res.StatusCode, nil
}

func PreviewMail(data dtos.RSDataSendMail) ([]byte, error) {
	logger.Info("Running test mail",
		"orgId", data.OrgId,
		"userId", data.UserId,
		"dashboard", data.UID,
		"report", data.Name,
		"url", setting.ReportingServerURL+setting.ReportingServerMailerEndPoint,
		"compressAttachment", data.CompressAttachment,
	)
	if setting.ReportingServerURL == "" {
		return nil, ErrSchedulerServiceUrlNotProvided
	}

	b, err := json.Marshal(data)
	if err != nil {
		logger.Error(err.Error())
		return nil, err
	}

	url := setting.ReportingServerURL + setting.ReportingServerMailerEndPoint
	payload := strings.NewReader(string(b))
	method := "POST"

	client := &http.Client{}

	req, err := http.NewRequest(method, url, payload)
	if err != nil {
		logger.Error(err.Error())
		return nil, err
	}

	req.Header.Add("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		logger.Error(err.Error())
		return nil, ErrSchedulerServiceUrlNotReachable
	}
	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		logger.Error(err.Error())
		return nil, ErrSchedulerServiceFailedToSendTestMail
	}

	if res.StatusCode != 200 {
		logger.Error("Failed", "status", res.Status)
		return nil, ErrSchedulerServiceFailedToSendTestMail
	}

	return body, nil
}

func ExecuteOnce(data dtos.RSDataExecute) ([]byte, error) {
	logger.Info("Running execute once",
		"orgId", data.OrgId,
		"userId", data.UserId,
		"dashboard", data.UID,
		"report", data.Name,
		"report_type", data.ReportType,
		"schedule_type", data.ScheduleType,
		"url", setting.ReportingServerURL+setting.ReportingServerExecuteOnceEndPoint,
	)

	if setting.ReportingServerURL == "" {
		return nil, ErrSchedulerServiceUrlNotProvided
	}

	b, err := json.Marshal(data)
	if err != nil {
		logger.Error(err.Error())
		return nil, err
	}

	url := setting.ReportingServerURL + setting.ReportingServerExecuteOnceEndPoint
	payload := strings.NewReader(string(b))
	method := "POST"

	client := &http.Client{}

	req, err := http.NewRequest(method, url, payload)
	if err != nil {
		logger.Error(err.Error())
		return nil, err
	}

	req.Header.Add("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		logger.Error(err.Error())
		return nil, ErrSchedulerServiceUrlNotReachable
	}
	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		logger.Error(err.Error())
		return nil, ErrSchedulerServiceFailedToExecuteOnce
	}

	if res.StatusCode != 200 {
		logger.Error("Failed", "status", res.Status)
		return nil, ErrSchedulerServiceFailedToExecuteOnce
	}

	return body, nil
}
