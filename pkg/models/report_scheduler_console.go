package models

import (
	"time"

	"github.com/grafana/grafana/pkg/bmc"
)

type RSJobStatus struct {
	Value       int       `xorm:"value" json:"value"`
	Id          int64     `xorm:"id" json:"-"`
	Description string    `xorm:"description" json:"description"`
	DateTime    time.Time `xorm:"date_time" json:"createdAt"`
}

type RSJobQueue struct {
	Id          int64     `xorm:"id" json:"jobId"`
	ElapsedTime int64     `xorm:"elapsed_time" json:"elapsedTime"`
	StartedAt   time.Time `xorm:"started_at" json:"startedAt"`
	FinishedAt  time.Time `xorm:"finished_at" json:"finishedAt"`
	FileKey     string    `xorm:"file_key" json:"-"`
	Deleted     bool      `xorm:"deleted" json:"deleted"`
}

type RSReportInfo struct {
	Id                     int64     `xorm:"id" json:"id"`
	JobId                  int64     `xorm:"job_id" json:"jobId"`
	ReportName             string    `xorm:"name" json:"reportName"`
	ReportType             string    `xorm:"report_type" json:"reportType"`
	ScheduleType           string    `xorm:"schedule_type" json:"scheduleType"`
	CreatedBy              string    `xorm:"created_by" json:"createdBy"`
	UserID                 int64     `xorm:"user_id" json:"userId"`
	Enabled                bool      `xorm:"enabled" json:"enabled"`
	DashName               string    `xorm:"title" json:"dashName"`
	DashUid                string    `xorm:"uid" json:"dashUid"`
	CreatedAt              time.Time `xorm:"created_at" json:"createdAt"`
	UpdatedAt              time.Time `xorm:"updated_at" json:"updatedAt"`
	NextAt                 int64     `xorm:"next_at" json:"nextAt"`
	LastAt                 int64     `xorm:"last_at" json:"lastAt"`
	TotalRuns              int64     `xorm:"count_runs" json:"totalRuns"`
	FailCount              int64     `xorm:"count_fail" json:"totalFail"`
	FailReason             string    `xorm:"last_fail" json:"lastFail"`
	LastState              string    `xorm:"state" json:"state"`
	FileKey                string    `xorm:"file_key" json:"-"`
	Deleted                bool      `xorm:"deleted" json:"deleted"`
	DynamicRecipients      string    `xorm:"dynamic_recipients" json:"dynamicRecipients"`
	IsDynamicBccRecipients bool      `xorm:"is_dynamic_bcc_recipients" json:"isDynamicBcc"`
	DynamicBursting        bool      `xorm:"dynamic_bursting" json:"dynamicBursting"`
}

type GetRSJobQueue struct {
	Queue  *RSJobQueue    `json:"queue"`
	Status []*RSJobStatus `json:"status"`
}

type GetRSJobQueueByJobId struct {
	JobId  int64
	Auth   bmc.Auth
	Result *GetRSJobQueue
}

type GetRSJobQueues struct {
	OrgID      int64
	UserID     int64
	ReportId   int64
	Limit      int
	Order      string
	IsOrgAdmin bool
	Result     []*GetRSJobQueue
}

type GetReportListJobQueue struct {
	Query  string
	Auth   bmc.Auth
	Result []*RSReportInfo
}
