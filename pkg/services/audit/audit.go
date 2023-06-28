package audit

import (
	"context"
)

type Service interface {
	CreateAuditRecord(context.Context, *CreateAuditRecordCommand) error
	Search(context.Context, *SearchAuditRecordsQuery) (*SearchAuditRecordsQueryResult, error)
}
