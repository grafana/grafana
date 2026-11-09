package accesscontrol

import (
	"crypto/sha256"
	"fmt"
	"math/big"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const (
	receiverUIDPermissionsMigrationID = "copy receiver permissions to the uids of receivers"

	receiverScopePrefix = "receivers:uid:"
	// Identifiers of the permissions that do not refer to a receiver: all of them, and the ability to create them.
	receiverScopeAllID = "*"
	receiverScopeNewID = "-"
)

// AddReceiverUIDPermissionsMigration copies the permissions that are scoped to a receiver to the UID the receiver has
// since it is no longer derived from its name.
// Receivers used to be identified by their base64 encoded name, and the scope of their permissions was derived from
// that. The UID of a receiver that has none persisted is now derived from the identifier in that scope, so the scope it
// has now follows from the one it had without needing the receivers, which is all this does. The previous permissions
// are kept, and the stored configurations are left as they are, as the UID is derived whenever they are read.
func AddReceiverUIDPermissionsMigration(mg *migrator.Migrator) {
	mg.AddMigration(receiverUIDPermissionsMigrationID, &receiverUIDPermissionsMigrator{})
}

type receiverUIDPermissionsMigrator struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = (*receiverUIDPermissionsMigrator)(nil)

func (m *receiverUIDPermissionsMigrator) SQL(migrator.Dialect) string {
	return "code migration"
}

func (m *receiverUIDPermissionsMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	var rows []accesscontrol.Permission
	err := sess.Where("kind = ? AND attribute = ?", "receivers", "uid").Find(&rows)
	if err != nil {
		return fmt.Errorf("failed to query receiver permissions: %w", err)
	}

	type permissionKey struct {
		roleID int64
		action string
		scope  string
	}
	existing := make(map[permissionKey]struct{}, len(rows))
	for _, row := range rows {
		existing[permissionKey{row.RoleID, row.Action, row.Scope}] = struct{}{}
	}

	now := time.Now()
	var toCreate []accesscontrol.Permission
	for _, row := range rows {
		if row.Identifier == receiverScopeAllID || row.Identifier == receiverScopeNewID {
			continue
		}
		identifier := receiverUIDFromPermissionIdentifier(row.Identifier)
		copied := row
		copied.ID = 0
		copied.Scope = receiverScopePrefix + identifier
		copied.Identifier = identifier
		copied.Created = now
		copied.Updated = now
		key := permissionKey{copied.RoleID, copied.Action, copied.Scope}
		if _, ok := existing[key]; ok {
			continue
		}
		existing[key] = struct{}{}
		toCreate = append(toCreate, copied)
	}

	err = batch(len(toCreate), batchSize, func(start, end int) error {
		_, err := sess.InsertMulti(toCreate[start:end])
		return err
	})
	if err != nil {
		return fmt.Errorf("failed to insert receiver permissions: %w", err)
	}
	mg.Logger.Info("Copied receiver permissions to the uids of receivers", "permissions", len(toCreate))
	return nil
}

// receiverUIDFromPermissionIdentifier is the UID of a receiver that has none persisted, given the identifier in the
// scope of the permissions to it from when its UID was derived from its name. It is frozen, as the migration must give
// the permissions the scope that the UID of the receiver has when it is read. The UID is short enough to be the
// identifier in its scope as it is.
func receiverUIDFromPermissionIdentifier(identifier string) string {
	h := sha256.Sum256([]byte("receiver\x00" + identifier))
	n := new(big.Int).SetBytes(h[:16])
	return fmt.Sprintf("%025s", n.Text(36))
}
