package accesscontrol

import (
	"strings"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const ManagedPermissionsMigrationID = "managed permissions migration"

func AddMigration(mg *migrator.Migrator) {
	permissionV1 := migrator.Table{
		Name: "permission",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "role_id", Type: migrator.DB_BigInt},
			{Name: "action", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "scope", Type: migrator.DB_Varchar, Length: 190, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"role_id"}},
			{Cols: []string{"role_id", "action", "scope"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create permission table", migrator.NewAddTableMigration(permissionV1))

	//-------  indexes ------------------
	mg.AddMigration("add unique index permission.role_id", migrator.NewAddIndexMigration(permissionV1, permissionV1.Indices[0]))
	mg.AddMigration("add unique index role_id_action_scope", migrator.NewAddIndexMigration(permissionV1, permissionV1.Indices[1]))

	roleV1 := migrator.Table{
		Name: "role",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "description", Type: migrator.DB_Text, Nullable: true},
			{Name: "version", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "org_id", Type: migrator.DB_BigInt},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "name"}, Type: migrator.UniqueIndex},
			{Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create role table", migrator.NewAddTableMigration(roleV1))

	mg.AddMigration("add column display_name", migrator.NewAddColumnMigration(roleV1, &migrator.Column{
		Name: "display_name", Type: migrator.DB_NVarchar, Length: 190, Nullable: true,
	}))

	mg.AddMigration("add column group_name", migrator.NewAddColumnMigration(roleV1, &migrator.Column{
		Name: "group_name", Type: migrator.DB_NVarchar, Length: 190, Nullable: true,
	}))
	//-------  indexes ------------------
	mg.AddMigration("add index role.org_id", migrator.NewAddIndexMigration(roleV1, roleV1.Indices[0]))
	mg.AddMigration("add unique index role_org_id_name", migrator.NewAddIndexMigration(roleV1, roleV1.Indices[1]))
	mg.AddMigration("add index role_org_id_uid", migrator.NewAddIndexMigration(roleV1, roleV1.Indices[2]))

	teamRoleV1 := migrator.Table{
		Name: "team_role",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt},
			{Name: "team_id", Type: migrator.DB_BigInt},
			{Name: "role_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "team_id", "role_id"}, Type: migrator.UniqueIndex},
			{Cols: []string{"team_id"}},
		},
	}

	mg.AddMigration("create team role table", migrator.NewAddTableMigration(teamRoleV1))

	//-------  indexes ------------------
	mg.AddMigration("add index team_role.org_id", migrator.NewAddIndexMigration(teamRoleV1, teamRoleV1.Indices[0]))
	mg.AddMigration("add unique index team_role_org_id_team_id_role_id", migrator.NewAddIndexMigration(teamRoleV1, teamRoleV1.Indices[1]))
	mg.AddMigration("add index team_role.team_id", migrator.NewAddIndexMigration(teamRoleV1, teamRoleV1.Indices[2]))

	userRoleV1 := migrator.Table{
		Name: "user_role",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt},
			{Name: "user_id", Type: migrator.DB_BigInt},
			{Name: "role_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}},
			{Cols: []string{"org_id", "user_id", "role_id"}, Type: migrator.UniqueIndex},
			{Cols: []string{"user_id"}},
		},
	}

	mg.AddMigration("create user role table", migrator.NewAddTableMigration(userRoleV1))

	//-------  indexes ------------------
	mg.AddMigration("add index user_role.org_id", migrator.NewAddIndexMigration(userRoleV1, userRoleV1.Indices[0]))
	mg.AddMigration("add unique index user_role_org_id_user_id_role_id", migrator.NewAddIndexMigration(userRoleV1, userRoleV1.Indices[1]))
	mg.AddMigration("add index user_role.user_id", migrator.NewAddIndexMigration(userRoleV1, userRoleV1.Indices[2]))

	builtinRoleV1 := migrator.Table{
		Name: "builtin_role",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "role", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "role_id", Type: migrator.DB_BigInt},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"role_id"}},
			{Cols: []string{"role"}},
		},
	}

	mg.AddMigration("create builtin role table", migrator.NewAddTableMigration(builtinRoleV1))

	//-------  indexes ------------------
	mg.AddMigration("add index builtin_role.role_id", migrator.NewAddIndexMigration(builtinRoleV1, builtinRoleV1.Indices[0]))
	mg.AddMigration("add index builtin_role.name", migrator.NewAddIndexMigration(builtinRoleV1, builtinRoleV1.Indices[1]))

	// Add org_id column to the builtin_role table
	mg.AddMigration("Add column org_id to builtin_role table", migrator.NewAddColumnMigration(builtinRoleV1, &migrator.Column{
		Name: "org_id", Type: migrator.DB_BigInt, Default: "0",
	}))

	mg.AddMigration("add index builtin_role.org_id", migrator.NewAddIndexMigration(builtinRoleV1, &migrator.Index{
		Cols: []string{"org_id"},
	}))

	mg.AddMigration("add unique index builtin_role_org_id_role_id_role", migrator.NewAddIndexMigration(builtinRoleV1, &migrator.Index{
		Cols: []string{"org_id", "role_id", "role"}, Type: migrator.UniqueIndex,
	}))

	// Make role.uid unique across Grafana instance
	mg.AddMigration("Remove unique index role_org_id_uid", migrator.NewDropIndexMigration(roleV1, &migrator.Index{
		Cols: []string{"org_id", "uid"}, Type: migrator.UniqueIndex,
	}))

	mg.AddMigration("add unique index role.uid", migrator.NewAddIndexMigration(roleV1, &migrator.Index{
		Cols: []string{"uid"}, Type: migrator.UniqueIndex,
	}))

	seedAssignmentV1 := migrator.Table{
		Name: "seed_assignment",
		Columns: []*migrator.Column{
			{Name: "builtin_role", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "role_name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"builtin_role", "role_name"}, Type: migrator.UniqueIndex},
		},
	}

	mg.AddMigration("create seed assignment table", migrator.NewAddTableMigration(seedAssignmentV1))

	//-------  indexes ------------------
	mg.AddMigration("add unique index builtin_role_role_name", migrator.NewAddIndexMigration(seedAssignmentV1, seedAssignmentV1.Indices[0]))

	mg.AddMigration("add column hidden to role table", migrator.NewAddColumnMigration(roleV1, &migrator.Column{
		Name: "hidden", Type: migrator.DB_Bool, Nullable: false, Default: "0",
	}))

	mg.AddMigration(ManagedPermissionsMigrationID, &managedPermissionMigrator{})
}

type managedPermissionMigrator struct {
	migrator.MigrationBase
}

func (sp *managedPermissionMigrator) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

func (sp *managedPermissionMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	logger := log.New("managed permissions migrator")

	type Permission struct {
		RoleName string `xorm:"role_name"`
		RoleID   int64  `xorm:"role_id"`
		OrgID    int64  `xorm:"org_id"`
		Action   string
		Scope    string
	}

	// get all orgs
	managedPermissions := []Permission{}
	if errFindPermissions := sess.SQL(`SELECT r.name as role_name, r.id as role_id, r.org_id as org_id,p.action, p.scope
	FROM permission AS p
	INNER JOIN role AS r ON p.role_id = r.id
	WHERE r.name LIKE "managed:builtins%"`).
		Find(&managedPermissions); errFindPermissions != nil {
		logger.Error("could not get the managed permissions", "error", errFindPermissions)
		return errFindPermissions
	}

	roleMap := make(map[int64]map[string]int64)
	permissionMap := make(map[int64]map[string][]Permission)

	// for each managed permission make a map of which permissions need to be added to inheritors
	for _, p := range managedPermissions {
		if _, ok := roleMap[p.OrgID]; !ok {
			roleMap[p.OrgID] = map[string]int64{p.RoleName: p.RoleID}
		} else {
			roleMap[p.OrgID][p.RoleName] = p.RoleID
		}

		roleName := parseRoleFromName(p.RoleName)
		for _, parent := range models.RoleType(roleName).Parents() {
			parentManagedRoleName := "managed:builtins:" + strings.ToLower(string(parent)) + ":permissions"
			if _, ok := permissionMap[p.OrgID]; !ok {
				permissionMap[p.OrgID] = map[string][]Permission{parentManagedRoleName: {p}}
			} else {
				permissionMap[p.OrgID][parentManagedRoleName] = append(permissionMap[p.OrgID][parentManagedRoleName], p)
			}

		}
	}

	now := time.Now()

	// Create missing permissions
	// Example setup:
	// editor read, query datasources:uid:2
	// editor read, query datasources:uid:1
	// admin read, query, write datasources:uid:1
	// we'd need to create admin read, query, write datasources:uid:2
	for orgID, orgMap := range permissionMap {
		for managedRole, permissions := range orgMap {
			// ensure managed role exists, create and add to map if it doesn't
			ok, err := sess.Get(&accesscontrol.Role{Name: managedRole, OrgID: orgID})
			if err != nil {
				return err
			}

			if !ok {
				uid, err := generateNewRoleUID(sess, orgID)
				if err != nil {
					return err
				}
				createdRole := accesscontrol.Role{Name: managedRole, OrgID: orgID, UID: uid, Created: now, Updated: now}
				if _, err := sess.Insert(&createdRole); err != nil {
					logger.Error("Unable to create managed role", "error", err)
					return err
				}

				connection := accesscontrol.BuiltinRole{
					RoleID:  createdRole.ID,
					OrgID:   orgID,
					Role:    parseRoleFromName(createdRole.Name),
					Created: now,
					Updated: now,
				}

				if _, err := sess.Insert(&connection); err != nil {
					logger.Error("Unable to create managed role connection", "error", err)
					return err
				}

				roleMap[orgID][managedRole] = createdRole.ID
			}

			// assign permissions if they don't exist to the role
			existed := 0
			roleID := roleMap[orgID][managedRole]
			for _, p := range permissions {
				perm := accesscontrol.Permission{RoleID: roleID, Action: p.Action, Scope: p.Scope, Created: now, Updated: now}
				if _, err := sess.Insert(&perm); err != nil {
					existed++
				}
			}

			if existed != 0 {
				logger.Warn("Ignoring already existing inherited managed permissions", "existed", existed)
			}
		}
	}

	return nil
}

func parseRoleFromName(roleName string) string {
	return strings.Title(strings.TrimSuffix(strings.TrimPrefix(roleName, "managed:builtins:"), ":permissions"))
}
