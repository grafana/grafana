package orguser

import (
	"context"
)

type Service interface {
	Insert(context.Context, *OrgUser) (int64, error)
}
