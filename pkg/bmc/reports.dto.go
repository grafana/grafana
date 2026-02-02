package bmc

type ReportsResponse struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Dashboard   struct {
		Id    int64  `json:"id"`
		Title string `json:"title"`
		Uid   string `json:"uid"`
	} `json:"dashboard"`
	ReportType    string           `json:"reportType"`
	ScheduleType  string           `json:"scheduleType"`
	ServerDir     string           `json:"serverDir"`
	FtpConfigId   string           `json:"ftpConfigId"`
	ExportOptions ExportOptionsDTO `json:"exportOptions"`
	Filter        struct {
		TimeRange   string `json:"timeRange"`
		TimeRangeTo string `json:"timeRangeTo"`
		Filter      string `json:"filter"`
	} `json:"filter"`
	Share struct {
		Subject            string   `json:"subject"`
		Message            string   `json:"message"`
		Recipients         []string `json:"recipients"`
		BCCRecipients      []string `json:"bccRecipients"`
		ReplyTo            string   `json:"replyTo"`
		CompressAttachment bool     `json:"compressAttachment"`
		CSVDelimiter       string   `json:"csvDelimiter"`
	} `json:"share"`
	Style struct {
		Layout       string `json:"layout"`
		Orientation  string `json:"orientation"`
		TableScaling bool   `json:"tableScaling"`
		Theme        string `json:"theme"`
	} `json:"style"`
	Schedule struct {
		Cron     string `json:"cron"`
		Timezone string `json:"timezone"`
	} `json:"schedule"`
	User struct {
		ID    int64  `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	} `json:"user"`
	Info struct {
		CreatedAt int64 `json:"createdAt"`
		UpdatedAt int64 `json:"updatedAt"`
		NextAt    int64 `json:"nextAt"`
		LastAt    int64 `json:"lastAt"`
	} `json:"info"`
	Enabled                bool   `json:"enabled"`
	HasDateStamp           bool   `json:"hasDateStamp"`
	DateStampFormat        string `json:"dateStampFormat"`
	HasTimeStamp           bool   `json:"hasTimeStamp"`
	NoDataCondition        bool   `json:"noDataCondition"`
	IsDynamicBccRecipients bool   `json:"isDynamicBccRecipients"`
	RecipientMode          string `json:"recipientMode"`
	DynamicRecipientDash   struct {
		Id    int64  `json:"id"`
		Title string `json:"title"`
		Uid   string `json:"uid"`
	} `json:"dynamicRecipientDash"`
	DynamicBursting bool `json:"dynamicBursting"`
}

type ReportPayload struct {
	ID           int64  `json:"id" required:"false"`
	Name         string `json:"name" required:"true"`
	Description  string `json:"description" required:"false"`
	ReportType   string `json:"report_type" required:"true"`
	ScheduleType string `json:"scheduleType" required:"false"`
	DashboardId  string `json:"dashboardId" required:"true"`

	Subject       string   `json:"subject" required:"false"`
	Message       string   `json:"message" required:"false"`
	Recipients    []string `json:"recipients" required:"false"`
	BCCRecipients []string `json:"bccRecipients" required:"false"`

	Filter      string `json:"filter" required:"false"`
	TimeRange   string `json:"timeRange" required:"false"`
	TimeRangeTo string `json:"TimeRangeTo" required:"false"`

	Orientation string `json:"orientation" required:"false"`
	Layout      string `json:"layout" required:"false"`

	Cron     string `json:"cron" required:"true"`
	Timezone string `json:"timezone" required:"true"`
	Enabled  string `json:"enabled" required:"false"`

	IsDynamicBccRecipients bool   `json:"isDynamicBccRecipients" required:"true"`
	RecipientMode          string `json:"recipientMode"`
	DynamicRecipientDashId string `json:"dynamicRecipientDashId" required:"false"`
	DynamicBursting        bool   `json:"dynamicBursting" required:"true"`
}
