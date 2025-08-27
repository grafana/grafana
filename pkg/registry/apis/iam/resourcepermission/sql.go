package resourcepermission

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util"
)

func (s *ResourcePermSqlBackend) createResourcePermission(ctx context.Context, dbHelper *legacysql.LegacyDatabaseHelper, ns types.NamespaceInfo, v0ResourcePerm *v0alpha1.ResourcePermission) (int64, error) {
	if v0ResourcePerm == nil {
		return 0, fmt.Errorf("resource permission cannot be nil")
	}

	if v0ResourcePerm.Name == "" {
		if v0ResourcePerm.GenerateName == "" {
			return 0, errEmptyName
		}
		rand, err := util.GetRandomString(10)
		if err != nil {
			return 0, fmt.Errorf("generating random string for resource permission name: %w", err)
		}
		v0ResourcePerm.Name = v0ResourcePerm.GenerateName + rand
	}

	if len(v0ResourcePerm.Spec.Permissions) == 0 {
		return 0, fmt.Errorf("resource permission must have at least one permission: %w", errInvalidSpec)
	}

	// Implement proper managed role pattern
	err := dbHelper.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
		// TODO: For each grant
		//       Check the target managed role exists
		//       If not, create it
		//       If yes, remove its permissions for that resource
		//       Add the new permissions to the managed role
		// for _, perm := range v0ResourcePerm.Spec.Permissions {
		//
		// }

		return nil
	})

	if err != nil {
		return 0, err
	}

	// Return a timestamp as resource version
	// TODO should we return the latest updated managed role?
	// Not sure since it could have effectively been updated for another resource than the one at stake.
	return int64(time.Now().UnixMilli()), nil
}
