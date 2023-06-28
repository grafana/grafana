package audit

import "time"

type AuditRecord struct {
	Id        int64     `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
	IpAddress string    `json:"ip_address"`
	Action    string    `json:"action"`
}

type AuditRecordDTO struct {
	Id        int64     `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
	IpAddress string    `json:"ip_address"`
	Action    string    `json:"action"`
}

type SearchAuditRecordsQuery struct {
	Limit  int
	Page   int
	Result SearchAuditRecordsQueryResult
}

type SearchAuditRecordsQueryResult struct {
	TotalCount   int64             `json:"totalCount"`
	AuditRecords []*AuditRecordDTO `json:"records"`
	Page         int               `json:"page"`
	PerPage      int               `json:"perPage"`
}

type CreateAuditRecordCommand struct {
	Username  string `json:"username" binding:"Required"`
	Action    string `json:"action" binding:"Required"`
	IpAddress string `json:"ip_address" binding:"Required"`

	Result AuditRecord `json:"-"`
}
