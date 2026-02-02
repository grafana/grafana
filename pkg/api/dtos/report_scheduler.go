package dtos

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type RSJobStatus struct {
	Status      int       `json:"status,omitempty"`
	Created     time.Time `json:"created,omitempty"`
	Description string    `json:"description,omitempty"`
	JobId       int64     `json:"jobId,omitempty"`
}
type RSJobQueue struct {
	Id          int64         `json:"id,omitempty"`
	StartedAt   time.Time     `json:"startedAt,omitempty"`
	FinishedAt  time.Time     `json:"finishedAt,omitempty"`
	ElapsedTime int64         `json:"elapsedTime,omitempty"`
	ReportId    int64         `json:"reportId,omitempty"`
	JobStatus   []RSJobStatus `json:"status,omitempty"`
}

type RSSettings struct {
	Id                  int64    `json:"id,omitempty"`
	LogoUrl             string   `json:"logoUrl"`
	FooterText          string   `json:"footerText"`
	FooterTextUrl       string   `json:"footerTextUrl"`
	FooterSentBy        bool     `json:"footerSentBy"`
	InternalDomainsOnly bool     `json:"internalDomainsOnly"`
	WhitelistedDomains  []string `json:"whitelistedDomains"`
	StorageRetention    int      `json:"storageRetention,omitempty"`
	DateFormat          string   `json:"dateFormat"`
}
type RSInfo struct {
	UserId    int64 `json:"createdBy"`
	CreatedAt int64 `json:"createdAt"`
	UpdatedAt int64 `json:"updatedAt"`
	NextAt    int64 `json:"nextAt"`
	LastAt    int64 `json:"lastAt"`
	Status    int   `json:"status"`
}
type RSData struct {
	Id                     int64      `json:"id"`
	Name                   string     `json:"name"`
	Description            string     `json:"description"`
	DashboardId            int64      `json:"dashboardId"`
	TimeRange              string     `json:"timeRange"`
	TimeRangeTo            string     `json:"timeRangeTo"`
	Filter                 string     `json:"filter"`
	Subject                string     `json:"subject"`
	Recipients             []string   `json:"recipients"`
	BCCRecipients          []string   `json:"bccRecipients"`
	ReplyTo                string     `json:"replyTo"`
	Message                string     `json:"message"`
	Orientation            string     `json:"orientation"`
	Layout                 string     `json:"layout"`
	Enabled                bool       `json:"enabled"`
	Cron                   string     `json:"cron"`
	Timezone               string     `json:"timezone"`
	StartFrom              *time.Time `json:"startFrom"`
	EndAt                  *time.Time `json:"endAt"`
	ReportType             string     `json:"reportType"`
	ScheduleType           string     `json:"scheduleType"`
	ServerDir              string     `json:"serverDir"`
	HasDateStamp           bool       `json:"hasDateStamp"`
	HasTimeStamp           bool       `json:"hasTimeStamp"`
	NoDataCondition        bool       `json:"noDataCondition"`
	IsDynamicBccRecipients bool       `json:"isDynamicBccRecipients"`
	RecipientMode          string     `json:"recipientMode"`
	DynamicRecipientDashId int64      `json:"dynamicRecipientDashId"`
	DynamicBursting        bool       `json:"dynamicBursting"`
	*RSInfo                `json:"info"`
}

type ListRS struct {
	Ids []int64 `json:"ids"`
}
type InsertRS struct {
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	DashboardId   int64    `json:"dashboardId"`
	Subject       string   `json:"subject"`
	Recipients    []string `json:"recipients"`
	BCCRecipients []string `json:"bccRecipients"`
	Message       string   `json:"message"`
	Orientation   string   `json:"orientation"`
	Layout        string   `json:"layout"`
	Cron          string   `json:"cron"`
	Timezone      string   `json:"timezone"`
	Enabled       bool     `json:"enabled"`

	ReplyTo                string    `json:"replyTo"`
	TimeRange              string    `json:"timeRange,omitempty"`
	TimeRangeTo            string    `json:"timeRangeTo,omitempty"`
	Filter                 string    `json:"filter,omitempty"`
	Settings               int64     `json:"settings"`
	StartFrom              time.Time `json:"startFrom,omitempty"`
	EndAt                  time.Time `json:"endAt,omitempty"`
	ReportType             string    `json:"reportType"`
	ScheduleType           string    `json:"scheduleType"`
	ServerDir              string    `json:"serverDir"`
	HasDateStamp           bool      `json:"hasDateStamp"`
	HasTimeStamp           bool      `json:"hasTimeStamp"`
	NoDataCondition        bool      `json:"noDataCondition"`
	CSVDelimiter           string    `json:"csvDelimiter"`
	IsDynamicBccRecipients bool      `json:"isDynamicBccRecipients"`
	RecipientMode          string    `json:"recipientMode"`
	DynamicRecipientDashId int64     `json:"dynamicRecipientDashId"`
	DynamicBursting        bool      `json:"dynamicBursting"`
}
type UpdateRS struct {
	Id int64 `json:"id"`
	InsertRS
}

type RSDataPreview struct {
	Id            int64            `json:"id,omitempty"`
	Name          string           `json:"name,omitempty"`
	Description   string           `json:"description,omitempty"`
	UID           string           `json:"uid,omitempty"`
	TimeRange     string           `json:"timeRange,omitempty"`
	TimeRangeTo   string           `json:"timeRangeTo,omitempty"`
	Filter        string           `json:"filter,omitempty"`
	Orientation   string           `json:"orientation,omitempty"`
	Layout        string           `json:"layout,omitempty"`
	Theme         string           `json:"theme,omitempty"`
	Variables     *simplejson.Json `json:"variables,omitempty"`
	Timezone      string           `json:"timezone,omitempty"`
	UserId        int64            `json:"userId,omitempty"`
	OrgId         int64            `json:"orgId,omitempty"`
	ReportType    string           `json:"reportType,omitempty"`
	CSVDelimiter  string           `json:"csvDelimiter"`
	TableScaling  bool             `json:"tableScaling,omitempty"`
	ExportOptions ExportOptionsDTO `json:"exportOptions"`
}

type RSDataSendMail struct {
	RSDataPreview
	Subject                 string   `json:"subject,omitempty"`
	Recipients              []string `json:"recipients,omitempty"`
	BCCRecipients           []string `json:"bccRecipients,omitempty"`
	Message                 string   `json:"message,omitempty"`
	ReplyTo                 string   `json:"replyTo,omitempty"`
	Cron                    string   `json:"cron"`
	CompressAttachment      bool     `json:"compressAttachment"`
	HasDateStamp            bool     `json:"hasDateStamp"`
	DateStampFormat         string   `json:"dateStampFormat"`
	HasTimeStamp            bool     `json:"hasTimeStamp"`
	NoDataCondition         bool     `json:"noDataCondition"`
	Sender                  string   `json:"emailAddress"`
	IsDynamicBccRecipients  bool     `json:"isDynamicBccRecipients"`
	RecipientMode           string   `json:"recipientMode"`
	DynamicRecipientDashUid string   `json:"dynamicRecipientDashUid,omitempty"`
	DynamicBursting         bool     `json:"dynamicBursting"`
}

type RSDataExecute struct {
	RSDataSendMail
	DashName     string `json:"dashName"`
	ScheduleType string `json:"scheduleType"`
	ServerDir    string `json:"serverDir"`
	FtpConfigId  string `json:"ftpConfigId"`
}

type ReportTenantDetails struct {
	Type  string `json:"type"`
	Limit int    `json:"limit"`
}

type ExportOptionsDTO struct {
	HideHeader bool   `json:"hideHeader,omitempty"`
	Enclosed   string `json:"enclosed,omitempty"` // "default" | "double"
	Newline    string `json:"newline,omitempty"`  // "CRLF" | "LF" | "CR"
}
