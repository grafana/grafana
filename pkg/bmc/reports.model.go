package bmc

import "time"

type GetAllReports struct {
	Auth      Auth
	QueryName string
	Result    []*ReportModel
}

type GetReportByID struct {
	Auth   Auth
	ID     int64
	Result *ReportModel
}

type ReportModel struct {
	ID          int64  `xorm:"id"`
	Name        string `xorm:"name"`
	Description string `xorm:"description"`

	DashID    int64  `xorm:"dash_id"`
	DashTitle string `xorm:"dash_title"`
	DashUid   string `xorm:"dash_uid"`

	ReportType   string `xorm:"report_type"`
	ScheduleType string `xorm:"schedule_type"`
	ServerDir    string `xorm:"server_dir"`
	FtpConfigId  string `xorm:"report_ftp_config_id"`

	TimeRange   string `xorm:"time_range"`
	TimeRangeTo string `xorm:"time_range_to"`
	Filter      string `xorm:"filter"`

	Subject       string `xorm:"subject"`
	Message       string `xorm:"message"`
	Recipients    string `xorm:"recipients"`
	BCCRecipients string `xorm:"bcc_recipients"`
	//ReplyTo    string   `xorm:"replyTo"`

	Layout       string `xorm:"layout"`
	Orientation  string `xorm:"orientation"`
	TableScaling bool   `xorm:"table_scaling"json:"tableScaling"`
	//Theme       string `xorm:"theme"`

	Cron     string `xorm:"cron"`
	Timezone string `xorm:"timezone"`

	UserID    int64  `xorm:"user_id"`
	UserName  string `xorm:"user_name"`
	UserEmail string `xorm:"user_email"`

	CreatedAt *time.Time `xorm:"created_at"`
	UpdatedAt *time.Time `xorm:"updated_at"`
	NextAt    int64      `xorm:"next_at"`
	LastAt    int64      `xorm:"last_at"`

	Enabled            bool   `json:"enabled"`
	HasDateStamp       bool   `json:"hasDateStamp"`
	HasTimeStamp       bool   `json:"hasTimeStamp"`
	NoDataCondition    bool   `json:"noDataCondition"`
	CompressAttachment bool   `json:"compressAttachment"`
	CSVDelimiter       string `xorm:"csv_delimiter"json:"csvDelimiter"`
	ExportOptions      string `xorm:"export_options" json:"exportOptions"`

	IsDynamicBccRecipients    bool   `xorm:"is_dynamic_bcc_recipients"`
	RecipientMode             string `xorm:"recipient_mode"`
	DynamicRecipientDashId    int64  `xorm:"dynamic_recipient_dash_id"`
	DynamicRecipientDashTitle string `xorm:"dynamic_recipient_dash_title"`
	DynamicRecipientDashUid   string `xorm:"dynamic_recipient_dash_uid"`
	DynamicBursting           bool   `xorm:"dynamic_bursting" json:"dynamicBursting"`
	DateStampFormat           string `xorm:"date_stamp_format"`
}

type ExportOptionsDTO struct {
	HideHeader bool   `json:"hideHeader,omitempty"`
	Enclosed   string `json:"enclosed,omitempty"`
	Newline    string `json:"newline,omitempty"`
}

type CreateReport struct {
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	DashboardId   int64    `json:"dashboardId"`
	Subject       string   `json:"subject"`
	Recipients    []string `json:"recipients"`
	BCCRecipients []string `json:"bccRecipients"`
	Message       string   `json:"message"`
	Orientation   string   `json:"orientation"`
	Layout        string   `json:"layout"`
	TableScaling  bool     `json:"tableScaling"`
	Cron          string   `json:"cron"`
	Timezone      string   `json:"timezone"`
	Enabled       bool     `json:"enabled"`

	ReplyTo                string           `json:"replyTo"`
	TimeRange              string           `json:"timeRange,omitempty"`
	TimeRangeTo            string           `json:"timeRangeTo,omitempty"`
	Filter                 string           `json:"filter,omitempty"`
	Settings               int64            `json:"settings"`
	StartFrom              time.Time        `json:"startFrom,omitempty"`
	EndAt                  time.Time        `json:"endAt,omitempty"`
	ReportType             string           `json:"reportType"`
	ScheduleType           string           `json:"scheduleType"`
	ServerDir              string           `json:"serverDir"`
	HasDateStamp           bool             `json:"hasDateStamp"`
	HasTimeStamp           bool             `json:"hasTimeStamp"`
	NoDataCondition        bool             `json:"noDataCondition"`
	CompressAttachment     bool             `json:"compressAttachment"`
	CSVDelimiter           string           `json:"csvDelimiter"`
	ExportOptions          ExportOptionsDTO `json:"exportOptions"`
	FtpConfigId            string           `json:"ftpConfigId"`
	IsDynamicBccRecipients bool             `json:"isDynamicBccRecipients"`
	RecipientMode          string           `json:"recipientMode"`
	DynamicRecipientDashId int64            `json:"dynamicRecipientDashId"`
	DynamicBursting        bool             `json:"dynamicBursting"`
	DateStampFormat        string           `json:"dateStampFormat"`
}

type UpdateReport struct {
	Id int64 `json:"id"`
	CreateReport
}

type DeleteReport struct {
	Ids []int64 `json:"ids"`
}

type Auth struct {
	UserID      int64
	OrgID       int64
	IsOrgAdmin  bool
	IsSuperUser bool
}

type GetReportsByOwnerID struct {
	ID        int64
	OrgID     int64
	QueryName string
	Result    []*ReportModel
}
