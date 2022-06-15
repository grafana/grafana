package orguser

import (
	"context"
)

type Service interface {
	Insert(context.Context, *OrgUser) error
}
