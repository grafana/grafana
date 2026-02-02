package bmc

import "time"

type ReportJobQueue struct {
	Id          int64     `xorm:"id" json:"jobId"`
	ElapsedTime int64     `xorm:"elapsed_time" json:"elapsedTime"`
	StartedAt   time.Time `xorm:"started_at" json:"startedAt"`
	FinishedAt  time.Time `xorm:"finished_at" json:"finishedAt"`
	FileKey     string    `xorm:"file_key" json:",omitempty"`
	FileVersion string    `xorm:"file_version" json:",omitempty"`
	Deleted     bool      `xorm:"deleted" json:"deleted"`
}

type ReportHistory struct {
	Id                int64     `xorm:"id" json:"id"`
	StartedAt         time.Time `xorm:"started_at" json:"startedAt"`
	Description       string    `xorm:"description" json:"description"`
	ElapsedTime       int64     `xorm:"elapsed_time" json:"elapsedTime"`
	Status            string    `xorm:"status" json:"status"`
	DownloadAvailable bool      `xorm:"can_download" json:"canDownload"`
}

type ExpiredReportsHistory struct {
	Id int64 `xorm:"id" json:"id"`
}

type GetReportJobQueue struct {
	JobID  int64
	OrgID  int64
	Result *ReportJobQueue
}

type GetReportHistory struct {
	OrgID    int64
	UserID   int64
	ReportID int64
	IsAdmin  bool
	Results  []*ReportHistory
}

type GetExpiredReportsHistory struct {
	Auth   Auth
	Result *ExpiredReportsHistory
}
