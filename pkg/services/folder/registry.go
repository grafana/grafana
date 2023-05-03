package folder

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

const AlertRuleKind = "alertrule"

type RegistryService interface {
	DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error
	CountInFolder(ctx context.Context, orgID int64, folderUID string, user *user.SignedInUser) (int64, error)
	Kind() string
}
