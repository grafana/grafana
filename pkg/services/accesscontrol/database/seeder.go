package database

import (
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/seeding"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

const basicRolePermBatchSize = 500

// LoadRoles returns all fixed and plugin roles (global org) with permissions, indexed by role name.
func (s *AccessControlStore) LoadRoles(ctx context.Context) (map[string]*accesscontrol.RoleDTO, error) {
	out := map[string]*accesscontrol.RoleDTO{}

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		type roleRow struct {
			ID          int64     `xorm:"id"`
			OrgID       int64     `xorm:"org_id"`
			Version     int64     `xorm:"version"`
			UID         string    `xorm:"uid"`
			Name        string    `xorm:"name"`
			DisplayName string    `xorm:"display_name"`
			Description string    `xorm:"description"`
			Group       string    `xorm:"group_name"`
			Hidden      bool      `xorm:"hidden"`
			Updated     time.Time `xorm:"updated"`
			Created     time.Time `xorm:"created"`
		}

		roles := []roleRow{}
		if err := sess.Table("role").
			Where("org_id = ?", accesscontrol.GlobalOrgID).
			Where("(name LIKE ? OR name LIKE ?)", accesscontrol.FixedRolePrefix+"%", accesscontrol.PluginRolePrefix+"%").
			Find(&roles); err != nil {
			return err
		}

		if len(roles) == 0 {
			return nil
		}

		roleIDs := make([]any, 0, len(roles))
		roleByID := make(map[int64]*accesscontrol.RoleDTO, len(roles))
		for _, r := range roles {
			dto := &accesscontrol.RoleDTO{
				ID:          r.ID,
				OrgID:       r.OrgID,
				Version:     r.Version,
				UID:         r.UID,
				Name:        r.Name,
				DisplayName: r.DisplayName,
				Description: r.Description,
				Group:       r.Group,
				Hidden:      r.Hidden,
				Updated:     r.Updated,
				Created:     r.Created,
			}
			out[dto.Name] = dto
			roleByID[dto.ID] = dto
			roleIDs = append(roleIDs, dto.ID)
		}

		type permRow struct {
			RoleID int64  `xorm:"role_id"`
			Action string `xorm:"action"`
			Scope  string `xorm:"scope"`
		}
		perms := []permRow{}
		if err := sess.Table("permission").In("role_id", roleIDs...).Find(&perms); err != nil {
			return err
		}

		for _, p := range perms {
			dto := roleByID[p.RoleID]
			if dto == nil {
				continue
			}
			dto.Permissions = append(dto.Permissions, accesscontrol.Permission{
				RoleID: p.RoleID,
				Action: p.Action,
				Scope:  p.Scope,
			})
		}

		return nil
	})

	return out, err
}

func (s *AccessControlStore) SetRole(ctx context.Context, existingRole *accesscontrol.RoleDTO, wantedRole accesscontrol.RoleDTO) error {
	if existingRole == nil {
		return nil
	}

	return s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table("role").
			Where("id = ? AND org_id = ?", existingRole.ID, accesscontrol.GlobalOrgID).
			Update(map[string]any{
				"display_name": wantedRole.DisplayName,
				"description":  wantedRole.Description,
				"group_name":   wantedRole.Group,
				"hidden":       wantedRole.Hidden,
				"updated":      time.Now(),
			})
		return err
	})
}

func (s *AccessControlStore) SetPermissions(ctx context.Context, existingRole *accesscontrol.RoleDTO, wantedRole accesscontrol.RoleDTO) error {
	if existingRole == nil {
		return nil
	}

	type key struct{ Action, Scope string }
	existing := map[key]struct{}{}
	for _, p := range existingRole.Permissions {
		existing[key{p.Action, p.Scope}] = struct{}{}
	}
	desired := map[key]struct{}{}
	for _, p := range wantedRole.Permissions {
		desired[key{p.Action, p.Scope}] = struct{}{}
	}

	toAdd := make([]accesscontrol.Permission, 0)
	toRemove := make([]accesscontrol.SeedPermission, 0)

	now := time.Now()
	for k := range desired {
		if _, ok := existing[k]; ok {
			continue
		}
		perm := accesscontrol.Permission{
			RoleID:  existingRole.ID,
			Action:  k.Action,
			Scope:   k.Scope,
			Created: now,
			Updated: now,
		}
		perm.Kind, perm.Attribute, perm.Identifier = accesscontrol.SplitScope(perm.Scope)
		toAdd = append(toAdd, perm)
	}

	for k := range existing {
		if _, ok := desired[k]; ok {
			continue
		}
		toRemove = append(toRemove, accesscontrol.SeedPermission{Action: k.Action, Scope: k.Scope})
	}

	if len(toAdd) == 0 && len(toRemove) == 0 {
		return nil
	}

	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if len(toRemove) > 0 {
			if err := DeleteRolePermissionTuples(sess, s.sql.GetDBType(), existingRole.ID, toRemove); err != nil {
				return err
			}
		}

		if len(toAdd) > 0 {
			_, err := sess.InsertMulti(toAdd)
			return err
		}

		return nil
	})
}

func (s *AccessControlStore) CreateRole(ctx context.Context, role accesscontrol.RoleDTO) error {
	now := time.Now()
	uid := role.UID
	if uid == "" && (strings.HasPrefix(role.Name, accesscontrol.FixedRolePrefix) || strings.HasPrefix(role.Name, accesscontrol.PluginRolePrefix)) {
		uid = accesscontrol.PrefixedRoleUID(role.Name)
	}
	r := accesscontrol.Role{
		OrgID:       accesscontrol.GlobalOrgID,
		Version:     role.Version,
		UID:         uid,
		Name:        role.Name,
		DisplayName: role.DisplayName,
		Description: role.Description,
		Group:       role.Group,
		Hidden:      role.Hidden,
		Created:     now,
		Updated:     now,
	}
	if r.Version == 0 {
		r.Version = 1
	}

	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Insert(&r); err != nil {
			return err
		}

		if len(role.Permissions) == 0 {
			return nil
		}

		// De-duplicate permissions on (action, scope) to avoid unique constraint violations.
		// Some role definitions may accidentally include duplicates.
		type permKey struct{ Action, Scope string }
		seen := make(map[permKey]struct{}, len(role.Permissions))

		perms := make([]accesscontrol.Permission, 0, len(role.Permissions))
		for _, p := range role.Permissions {
			k := permKey{Action: p.Action, Scope: p.Scope}
			if _, ok := seen[k]; ok {
				continue
			}
			seen[k] = struct{}{}

			perm := accesscontrol.Permission{
				RoleID:  r.ID,
				Action:  p.Action,
				Scope:   p.Scope,
				Created: now,
				Updated: now,
			}
			perm.Kind, perm.Attribute, perm.Identifier = accesscontrol.SplitScope(perm.Scope)
			perms = append(perms, perm)
		}
		_, err := sess.InsertMulti(perms)
		return err
	})
}

func (s *AccessControlStore) DeleteRoles(ctx context.Context, roleUIDs []string) error {
	if len(roleUIDs) == 0 {
		return nil
	}

	uids := make([]any, 0, len(roleUIDs))
	for _, uid := range roleUIDs {
		uids = append(uids, uid)
	}

	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		type row struct {
			ID  int64  `xorm:"id"`
			UID string `xorm:"uid"`
		}
		rows := []row{}
		if err := sess.Table("role").
			Where("org_id = ?", accesscontrol.GlobalOrgID).
			In("uid", uids...).
			Find(&rows); err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}

		roleIDs := make([]any, 0, len(rows))
		for _, r := range rows {
			roleIDs = append(roleIDs, r.ID)
		}

		// Remove permissions and assignments first to avoid FK issues (if enabled).
		{
			args := append([]any{"DELETE FROM permission WHERE role_id IN (?" + strings.Repeat(",?", len(roleIDs)-1) + ")"}, roleIDs...)
			if _, err := sess.Exec(args...); err != nil {
				return err
			}
		}
		{
			args := append([]any{"DELETE FROM user_role WHERE role_id IN (?" + strings.Repeat(",?", len(roleIDs)-1) + ")"}, roleIDs...)
			if _, err := sess.Exec(args...); err != nil {
				return err
			}
		}
		{
			args := append([]any{"DELETE FROM team_role WHERE role_id IN (?" + strings.Repeat(",?", len(roleIDs)-1) + ")"}, roleIDs...)
			if _, err := sess.Exec(args...); err != nil {
				return err
			}
		}
		{
			args := append([]any{"DELETE FROM builtin_role WHERE role_id IN (?" + strings.Repeat(",?", len(roleIDs)-1) + ")"}, roleIDs...)
			if _, err := sess.Exec(args...); err != nil {
				return err
			}
		}

		args := append([]any{"DELETE FROM role WHERE org_id = ? AND uid IN (?" + strings.Repeat(",?", len(uids)-1) + ")", accesscontrol.GlobalOrgID}, uids...)
		_, err := sess.Exec(args...)
		return err
	})
}

// OSS basic-role permission refresh uses seeding.Seeder.Seed() with a desired set computed in memory.
// These methods implement the permission seeding part of seeding.SeedingBackend against the current permission table.
func (s *AccessControlStore) LoadPrevious(ctx context.Context) (map[accesscontrol.SeedPermission]struct{}, error) {
	var out map[accesscontrol.SeedPermission]struct{}
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := LoadBasicRoleSeedPermissions(sess)
		if err != nil {
			return err
		}

		out = make(map[accesscontrol.SeedPermission]struct{}, len(rows))
		for _, r := range rows {
			r.Origin = ""
			out[r] = struct{}{}
		}
		return nil
	})
	return out, err
}

func (s *AccessControlStore) Apply(ctx context.Context, added, removed []accesscontrol.SeedPermission, updated map[accesscontrol.SeedPermission]accesscontrol.SeedPermission) error {
	rolesToUpgrade := seeding.RolesToUpgrade(added, removed)

	// Run the same OSS apply logic as ossBasicRoleSeedBackend.Apply inside a single transaction.
	return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		defs := accesscontrol.BuildBasicRoleDefinitions()
		builtinToRoleID, err := EnsureBasicRolesExist(sess, defs)
		if err != nil {
			return err
		}

		backend := &ossBasicRoleSeedBackend{
			sess:            sess,
			now:             time.Now(),
			builtinToRoleID: builtinToRoleID,
			desired:         nil,
			dbType:          s.sql.GetDBType(),
		}
		if err := backend.Apply(ctx, added, removed, updated); err != nil {
			return err
		}

		return BumpBasicRoleVersions(sess, rolesToUpgrade)
	})
}

// EnsureBasicRolesExist ensures the built-in basic roles exist in the role table and are bound in builtin_role.
// It returns a mapping from builtin role name (for example "Admin") to role ID.
func EnsureBasicRolesExist(sess *db.Session, defs map[string]*accesscontrol.RoleDTO) (map[string]int64, error) {
	uidToBuiltin := make(map[string]string, len(defs))
	uids := make([]any, 0, len(defs))
	for builtin, def := range defs {
		uidToBuiltin[def.UID] = builtin
		uids = append(uids, def.UID)
	}

	type roleRow struct {
		ID  int64  `xorm:"id"`
		UID string `xorm:"uid"`
	}

	rows := []roleRow{}
	if err := sess.Table("role").
		Where("org_id = ?", accesscontrol.GlobalOrgID).
		In("uid", uids...).
		Find(&rows); err != nil {
		return nil, err
	}

	ts := time.Now()

	builtinToRoleID := make(map[string]int64, len(defs))
	for _, r := range rows {
		br, ok := uidToBuiltin[r.UID]
		if !ok {
			continue
		}
		builtinToRoleID[br] = r.ID
	}

	for builtin, def := range defs {
		roleID, ok := builtinToRoleID[builtin]
		if !ok {
			role := accesscontrol.Role{
				OrgID:       def.OrgID,
				Version:     def.Version,
				UID:         def.UID,
				Name:        def.Name,
				DisplayName: def.DisplayName,
				Description: def.Description,
				Group:       def.Group,
				Hidden:      def.Hidden,
				Created:     ts,
				Updated:     ts,
			}
			if _, err := sess.Insert(&role); err != nil {
				return nil, err
			}
			roleID = role.ID
			builtinToRoleID[builtin] = roleID
		}

		has, err := sess.Table("builtin_role").
			Where("role_id = ? AND role = ? AND org_id = ?", roleID, builtin, accesscontrol.GlobalOrgID).
			Exist()
		if err != nil {
			return nil, err
		}
		if !has {
			br := accesscontrol.BuiltinRole{
				RoleID:  roleID,
				OrgID:   accesscontrol.GlobalOrgID,
				Role:    builtin,
				Created: ts,
				Updated: ts,
			}
			if _, err := sess.Table("builtin_role").Insert(&br); err != nil {
				return nil, err
			}
		}
	}

	return builtinToRoleID, nil
}

// DeleteRolePermissionTuples deletes permissions for a single role by (action, scope) pairs.
//
// It uses a row-constructor IN clause where supported (MySQL, Postgres, SQLite) and falls back
// to a WHERE ... OR ... form for MSSQL.
func DeleteRolePermissionTuples(sess *db.Session, dbType core.DbType, roleID int64, perms []accesscontrol.SeedPermission) error {
	if len(perms) == 0 {
		return nil
	}

	if dbType == migrator.MSSQL {
		// MSSQL doesn't support (action, scope) IN ((?,?),(?,?)) row constructors.
		where := make([]string, 0, len(perms))
		args := make([]any, 0, 1+len(perms)*2)
		args = append(args, roleID)
		for _, p := range perms {
			where = append(where, "(action = ? AND scope = ?)")
			args = append(args, p.Action, p.Scope)
		}
		_, err := sess.Exec(
			append([]any{
				"DELETE FROM permission WHERE role_id = ? AND (" + strings.Join(where, " OR ") + ")",
			}, args...)...,
		)
		return err
	}

	args := make([]any, 0, 1+len(perms)*2)
	args = append(args, roleID)
	for _, p := range perms {
		args = append(args, p.Action, p.Scope)
	}
	sql := "DELETE FROM permission WHERE role_id = ? AND (action, scope) IN (" +
		strings.Repeat("(?, ?),", len(perms)-1) + "(?, ?))"
	_, err := sess.Exec(append([]any{sql}, args...)...)
	return err
}

type ossBasicRoleSeedBackend struct {
	sess            *db.Session
	now             time.Time
	builtinToRoleID map[string]int64
	desired         map[accesscontrol.SeedPermission]struct{}
	dbType          core.DbType
}

func (b *ossBasicRoleSeedBackend) LoadPrevious(_ context.Context) (map[accesscontrol.SeedPermission]struct{}, error) {
	rows, err := LoadBasicRoleSeedPermissions(b.sess)
	if err != nil {
		return nil, err
	}

	out := make(map[accesscontrol.SeedPermission]struct{}, len(rows))
	for _, r := range rows {
		// Ensure the key matches what OSS seeding uses (Origin is always empty for basic role refresh).
		r.Origin = ""
		out[r] = struct{}{}
	}
	return out, nil
}

func (b *ossBasicRoleSeedBackend) LoadDesired(_ context.Context) (map[accesscontrol.SeedPermission]struct{}, error) {
	return b.desired, nil
}

func (b *ossBasicRoleSeedBackend) Apply(_ context.Context, added, removed []accesscontrol.SeedPermission, updated map[accesscontrol.SeedPermission]accesscontrol.SeedPermission) error {
	// Delete removed permissions (this includes user-defined permissions that aren't in desired).
	if len(removed) > 0 {
		permsByRoleID := map[int64][]accesscontrol.SeedPermission{}
		for _, p := range removed {
			roleID, ok := b.builtinToRoleID[p.BuiltInRole]
			if !ok {
				continue
			}
			permsByRoleID[roleID] = append(permsByRoleID[roleID], p)
		}

		for roleID, perms := range permsByRoleID {
			// Chunk to keep statement sizes and parameter counts bounded.
			if err := batch(len(perms), basicRolePermBatchSize, func(start, end int) error {
				return DeleteRolePermissionTuples(b.sess, b.dbType, roleID, perms[start:end])
			}); err != nil {
				return err
			}
		}
	}

	// Insert added permissions and updated-target permissions.
	toInsertSeed := make([]accesscontrol.SeedPermission, 0, len(added)+len(updated))
	toInsertSeed = append(toInsertSeed, added...)
	for _, v := range updated {
		toInsertSeed = append(toInsertSeed, v)
	}
	if len(toInsertSeed) == 0 {
		return nil
	}

	// De-duplicate on (role_id, action, scope). This avoids unique constraint violations when:
	// - the same permission appears in both added and updated
	// - multiple plugin origins grant the same permission (Origin is not persisted in permission table)
	type permKey struct {
		RoleID int64
		Action string
		Scope  string
	}
	seen := make(map[permKey]struct{}, len(toInsertSeed))

	toInsert := make([]accesscontrol.Permission, 0, len(toInsertSeed))
	for _, p := range toInsertSeed {
		roleID, ok := b.builtinToRoleID[p.BuiltInRole]
		if !ok {
			continue
		}
		k := permKey{RoleID: roleID, Action: p.Action, Scope: p.Scope}
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}

		perm := accesscontrol.Permission{
			RoleID:  roleID,
			Action:  p.Action,
			Scope:   p.Scope,
			Created: b.now,
			Updated: b.now,
		}
		perm.Kind, perm.Attribute, perm.Identifier = accesscontrol.SplitScope(perm.Scope)
		toInsert = append(toInsert, perm)
	}

	return batch(len(toInsert), basicRolePermBatchSize, func(start, end int) error {
		// MySQL: ignore conflicts to make seeding idempotent under retries/concurrency.
		// Conflicts can happen if the same permission already exists (unique on role_id, action, scope).
		if b.dbType == migrator.MySQL {
			args := make([]any, 0, (end-start)*8)
			for i := start; i < end; i++ {
				p := toInsert[i]
				args = append(args, p.RoleID, p.Action, p.Scope, p.Kind, p.Attribute, p.Identifier, p.Updated, p.Created)
			}
			sql := append([]any{`INSERT IGNORE INTO permission (role_id, action, scope, kind, attribute, identifier, updated, created) VALUES ` +
				strings.Repeat("(?, ?, ?, ?, ?, ?, ?, ?),", end-start-1) + "(?, ?, ?, ?, ?, ?, ?, ?)"}, args...)
			_, err := b.sess.Exec(sql...)
			return err
		}

		_, err := b.sess.InsertMulti(toInsert[start:end])
		return err
	})
}

func batch(count, size int, eachFn func(start, end int) error) error {
	for i := 0; i < count; {
		end := i + size
		if end > count {
			end = count
		}
		if err := eachFn(i, end); err != nil {
			return err
		}
		i = end
	}
	return nil
}

// BumpBasicRoleVersions increments the role version for the given builtin basic roles (Viewer/Editor/Admin/Grafana Admin).
// Unknown role names are ignored.
func BumpBasicRoleVersions(sess *db.Session, basicRoles []string) error {
	if len(basicRoles) == 0 {
		return nil
	}

	defs := accesscontrol.BuildBasicRoleDefinitions()
	uids := make([]any, 0, len(basicRoles))
	for _, br := range basicRoles {
		def, ok := defs[br]
		if !ok {
			continue
		}
		uids = append(uids, def.UID)
	}
	if len(uids) == 0 {
		return nil
	}

	sql := "UPDATE role SET version = version + 1 WHERE org_id = ? AND uid IN (?" + strings.Repeat(",?", len(uids)-1) + ")"
	_, err := sess.Exec(append([]any{sql, accesscontrol.GlobalOrgID}, uids...)...)
	return err
}

// LoadBasicRoleSeedPermissions returns the current (builtin_role, action, scope) permissions granted to basic roles.
// It sets Origin to empty.
func LoadBasicRoleSeedPermissions(sess *db.Session) ([]accesscontrol.SeedPermission, error) {
	rows := []accesscontrol.SeedPermission{}
	err := sess.SQL(
		`SELECT role.display_name AS builtin_role, p.action, p.scope, '' AS origin
		 FROM role INNER JOIN permission AS p ON p.role_id = role.id
		 WHERE role.org_id = ? AND role.name LIKE 'basic:%'`,
		accesscontrol.GlobalOrgID,
	).Find(&rows)
	return rows, err
}
