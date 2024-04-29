package database

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol/embedserver"

	zclient "github.com/grafana/zanzana/pkg/service/client"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// FIXME: Only one way sync is implemented for now. RBAC->Zanzana
func (s *AccessControlStore) SynchronizeUserData(ctx context.Context, zanzanaService *embedserver.Service) error {
	cl, err := zanzanaService.GetClient(ctx, "1")
	if err != nil {
		return err
	}

	// Sync orgs
	if err := s.syncOrgs(ctx, cl); err != nil {
		return err
	}

	// Sync org memberships
	if err := s.syncOrgMembership(ctx, cl); err != nil {
		return err
	}

	// sync Teams
	if err := s.syncTeams(ctx, cl); err != nil {
		return err
	}

	// Sync Team memberships
	if err := s.SyncTeamMemberships(ctx, cl); err != nil {
		return err
	}

	// Sync Managed permissions
	if err := s.SyncManagedRolePermissions(ctx, cl); err != nil {
		return err
	}

	// Sync Role assignments
	if err := s.SyncRoleAssignments(ctx, cl); err != nil {
		return err
	}

	// Sync Folder relations
	if err := s.SyncFolderRelations(ctx, cl); err != nil {
		return err
	}

	// Sync Dashboard relations
	if err := s.SyncDashboardRelations(ctx, cl); err != nil {
		return err
	}

	return nil
}

func (s *AccessControlStore) syncOrgs(ctx context.Context, cl *zclient.GRPCClient) error {
	tupleKeys := map[string]*openfgav1.TupleKey{}
	logger := log.New("accesscontrol.syncOrgs")

	// should we use UID as the user identifier?
	query := `SELECT id FROM org`
	type org struct {
		Id int64 `xorm:"id"`
	}

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.SQL(query).Rows(new(org))
		if err != nil {
			return err
		}
		defer func() {
			if err := rows.Close(); err != nil {
				logger.Error("Failed to close rows", "error", err)
			}
		}()

		for rows.Next() {
			orgRow := org{}
			if err := rows.Scan(&orgRow); err != nil {
				return err
			}

			// Org belongs to the instance
			key := &openfgav1.TupleKey{
				User:     "instance:0",
				Relation: "instance",
				Object:   "org:" + strconv.FormatInt(orgRow.Id, 10), // "org:1
			}

			tupleKeys[key.User+key.Relation+key.Object] = key
		}

		return nil
	})
	if err != nil {
		return err
	}

	logger.Info("Synchronizing orgs", "orgs", len(tupleKeys))
	return batchWrite(ctx, tupleKeys, cl)
}

func (s *AccessControlStore) syncOrgMembership(ctx context.Context, cl *zclient.GRPCClient) error {
	tupleKeys := map[string]*openfgav1.TupleKey{}
	logger := log.New("accesscontrol.syncOrgMembership")

	// we should use UID as the user identifier
	query := `SELECT user_id, org_id, role FROM org_user`
	type membership struct {
		OrgId  int64  `xorm:"org_id"`
		UserId int64  `xorm:"user_id"`
		Role   string `xorm:"role"`
	}
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.SQL(query).Rows(new(membership))
		if err != nil {
			return err
		}
		defer func() {
			if err := rows.Close(); err != nil {
				logger.Error("Failed to close rows", "error", err)
			}
		}()

		for rows.Next() {
			memb := membership{}
			if err := rows.Scan(&memb); err != nil {
				return err
			}

			// membership
			key := &openfgav1.TupleKey{
				User:     "user:" + strconv.FormatInt(memb.UserId, 10), // "user:1"
				Relation: "member",
				Object:   "org:" + strconv.FormatInt(memb.OrgId, 10), // "org:1
			}

			// basic role
			tupleKeys[key.User+key.Relation+key.Object] = key

			key = &openfgav1.TupleKey{
				User:     "user:" + strconv.FormatInt(memb.UserId, 10), // "user:1"
				Relation: "assignee",
				Object:   zclient.GenerateBasicRoleResource(memb.Role, memb.OrgId), // "role:basic_admin_1"
			}

			// basic role
			tupleKeys[key.User+key.Relation+key.Object] = key
		}

		return nil
	})
	if err != nil {
		return err
	}

	logger.Info("Synchronizing org membership", "userOrgMapCount", len(tupleKeys))
	return batchWrite(ctx, tupleKeys, cl)
}

func batchWrite(ctx context.Context, tupleKeys map[string]*openfgav1.TupleKey, cl *zclient.GRPCClient) error {
	flatTuples := make([]*openfgav1.TupleKey, 0, len(tupleKeys))
	for _, v := range tupleKeys {
		flatTuples = append(flatTuples, v)
	}

	batchSize := 100

	for i := 0; i < len(flatTuples); i += batchSize {
		end := i + batchSize

		if end > len(flatTuples) {
			end = len(flatTuples)
		}

		_, err := cl.Write(ctx, &openfgav1.WriteRequest{
			StoreId:              cl.MustStoreID(ctx),
			AuthorizationModelId: cl.AuthorizationModelID,
			Writes: &openfgav1.WriteRequestWrites{
				TupleKeys: flatTuples[i:end],
			},
		})

		if err != nil {

			return err
		}
	}

	return nil
}
func (s *AccessControlStore) syncTeams(ctx context.Context, cl *zclient.GRPCClient) error {
	tupleKeys := map[string]*openfgav1.TupleKey{}
	logger := log.New("accesscontrol.syncTeams")

	// we should migrate to use UID as the team identifier?
	query := `SELECT id, org_id FROM team`
	type team struct {
		Id    int64 `xorm:"id"`
		OrgId int64 `xorm:"org_id"`
	}

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.SQL(query).Rows(new(team))
		if err != nil {
			return err
		}
		defer func() {
			if err := rows.Close(); err != nil {
				logger.Error("Failed to close rows", "error", err)
			}
		}()

		for rows.Next() {
			teamRow := team{}
			if err := rows.Scan(&teamRow); err != nil {
				return err
			}

			// Team belongs to the org
			key := &openfgav1.TupleKey{
				User:     "org:" + strconv.FormatInt(teamRow.OrgId, 10), // "org:1"
				Relation: "org",
				Object:   "team:" + strconv.FormatInt(teamRow.Id, 10), // "team:1"
			}

			tupleKeys[key.User+key.Relation+key.Object] = key
		}

		return nil
	})
	if err != nil {
		return err
	}

	logger.Info("Synchronizing teams", "teams", len(tupleKeys))
	return batchWrite(ctx, tupleKeys, cl)
}

func (s *AccessControlStore) SyncTeamMemberships(ctx context.Context, cl *zclient.GRPCClient) error {
	tupleKeys := map[string]*openfgav1.TupleKey{}
	logger := log.New("accesscontrol.syncTeamMemberships")

	query := `SELECT id, org_id, team_id, user_id, permission FROM team_member`
	type teamMembership struct {
		Id         int64 `xorm:"id"`
		OrgId      int64 `xorm:"org_id"`
		TeamId     int64 `xorm:"team_id"`
		UserId     int64 `xorm:"user_id"`
		Permission int64 `xorm:"permission"`
	}

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.SQL(query).Rows(new(teamMembership))
		if err != nil {
			return err
		}
		defer func() {
			if err := rows.Close(); err != nil {
				logger.Error("Failed to close rows", "error", err)
			}
		}()

		for rows.Next() {
			membershipRow := teamMembership{}
			if err := rows.Scan(&membershipRow); err != nil {
				return err
			}

			teamKey := "team:" + strconv.FormatInt(membershipRow.TeamId, 10)
			userKey := "user:" + strconv.FormatInt(membershipRow.UserId, 10)
			relation := "member"
			if membershipRow.Permission == 4 { // DASHBOARD_PERMISSION_ADMIN
				relation = "admin"
			}

			// Define relations based on the permission level
			key := &openfgav1.TupleKey{
				User:     userKey,
				Relation: relation,
				Object:   teamKey,
			}
			tupleKeys[key.User+key.Relation+key.Object] = key
		}

		return nil
	})
	if err != nil {
		return err
	}

	logger.Info("Synchronizing team memberships", "memberships", len(tupleKeys))
	return batchWrite(ctx, tupleKeys, cl)
}

func (s *AccessControlStore) SyncRoleAssignments(ctx context.Context, cl *zclient.GRPCClient) error {
	roleAssignmentKeys := map[string]*openfgav1.TupleKey{}
	logger := log.New("accesscontrol.SyncRoleAssignments")

	query := `
	SELECT r.id, r.uid, r.name, r.org_id, br.role, ur.user_id, tr.team_id
	FROM role r
	LEFT JOIN builtin_role br ON r.id = br.role_id AND br.role IS NOT NULL
	LEFT JOIN user_role ur ON r.id = ur.role_id AND ur.user_id IS NOT NULL
	LEFT JOIN team_role tr ON r.id = tr.role_id AND tr.team_id IS NOT NULL
	`
	type roleAssignment struct {
		Id     int64  `xorm:"id"`
		Uid    string `xorm:"uid"`
		Name   string `xorm:"name"`
		OrgId  int64  `xorm:"org_id"`
		Role   string `xorm:"role"`
		UserId int64  `xorm:"user_id"`
		TeamId int64  `xorm:"team_id"`
	}
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.SQL(query).Rows(new(roleAssignment))
		if err != nil {
			return err
		}
		defer func() {
			if err := rows.Close(); err != nil {
				logger.Error("Failed to close rows", "error", err)
			}
		}()

		for rows.Next() {
			ra := roleAssignment{}
			if err := rows.Scan(&ra); err != nil {
				return err
			}

			// Assign to user
			if ra.UserId != 0 {
				key := &openfgav1.TupleKey{
					User:     "user:" + strconv.FormatInt(ra.UserId, 10), // "user:1"
					Relation: "assignee",
					Object:   "role:" + ra.Uid, // "role:ddenihn8qbpj4f"
				}
				roleAssignmentKeys[key.User+key.Relation+key.Object] = key
			}

			// Assign to team
			if ra.TeamId != 0 {
				key := &openfgav1.TupleKey{
					User:     "team:" + strconv.FormatInt(ra.TeamId, 10) + "#member", // "team:1"
					Relation: "assignee",
					Object:   "role:" + ra.Uid, // "role:ddenihn8qbpj4f"
				}
				roleAssignmentKeys[key.User+key.Relation+key.Object] = key
			}

			// Assign to builtin role
			if ra.Role != "" {
				key := &openfgav1.TupleKey{
					User:     zclient.GenerateBasicRoleResource(ra.Role, ra.OrgId) + "#assignee", // "role:basic_admin_1"
					Relation: "assignee",
					Object:   "role:" + ra.Uid, // "role:ddenihn8qbpj4f"
				}
				roleAssignmentKeys[key.User+key.Relation+key.Object] = key
			}
		}

		return nil
	})
	if err != nil {
		return err
	}

	logger.Info("Synchronizing role assignments", "assignments", len(roleAssignmentKeys))
	return batchWrite(ctx, roleAssignmentKeys, cl)
}

func (s *AccessControlStore) SyncManagedRolePermissions(ctx context.Context, cl *zclient.GRPCClient) error {
	rolePermissionKeys := map[string]*openfgav1.TupleKey{}
	logger := log.New("accesscontrol.SyncManagedRolePermissions")

	query := `
	SELECT r.uid, p.action, p.scope, p.kind, p.attribute, p.identifier
	FROM role r
	JOIN permission p ON r.id = p.role_id
	WHERE r.name LIKE "managed:%"
	`
	type rolePermission struct {
		Uid        string `xorm:"uid"`
		Action     string `xorm:"action"`
		Scope      string `xorm:"scope"`
		Kind       string `xorm:"kind"`
		Attribute  string `xorm:"attribute"`
		Identifier string `xorm:"identifier"`
	}
	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.SQL(query).Rows(new(rolePermission))
		if err != nil {
			return err
		}
		defer func() {
			if err := rows.Close(); err != nil {
				logger.Error("Failed to close rows", "error", err)
			}
		}()

		for rows.Next() {
			rp := rolePermission{}
			if err := rows.Scan(&rp); err != nil {
				return err
			}

			container := zclient.FolderContainer
			if rp.Kind != "folders" {
				container = ""
			}
			relation, object := zclient.ConvertToRelationObject(rp.Action, rp.Scope, rp.Identifier, container)
			logger.Debug("Adding permission to tuple", "role", rp.Uid, "relation", relation, "object", object)
			key := &openfgav1.TupleKey{
				User:     "role:" + rp.Uid + "#assignee",
				Relation: relation,
				Object:   object,
			}
			rolePermissionKeys[key.User+key.Relation+key.Object] = key
		}

		return nil
	})
	if err != nil {
		return err
	}

	logger.Info("Synchronizing managed role permissions", "permissions", len(rolePermissionKeys))
	return batchWrite(ctx, rolePermissionKeys, cl)
}

func (s *AccessControlStore) SyncFolderRelations(ctx context.Context, cl *zclient.GRPCClient) error {
	tupleKeys := map[string]*openfgav1.TupleKey{}
	logger := log.New("accesscontrol.syncFolderRelations")

	query := `SELECT id, uid, org_id, title, description, parent_uid FROM folder`
	type folder struct {
		Id          int64  `xorm:"id"`
		Uid         string `xorm:"uid"`
		OrgId       int64  `xorm:"org_id"`
		Title       string `xorm:"title"`
		Description string `xorm:"description"`
		ParentUid   string `xorm:"parent_uid"`
	}

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.SQL(query).Rows(new(folder))
		if err != nil {
			return err
		}
		defer func() {
			if err := rows.Close(); err != nil {
				logger.Error("Failed to close rows", "error", err)
			}
		}()

		for rows.Next() {
			folderRow := folder{}
			if err := rows.Scan(&folderRow); err != nil {
				return err
			}

			orgKey := "org:" + strconv.FormatInt(folderRow.OrgId, 10)
			folderKey := "folder:" + folderRow.Uid
			parentFolderKey := "folder:" + folderRow.ParentUid

			// Define relations based on the org and parent folder
			orgFolderKey := &openfgav1.TupleKey{
				User:     orgKey,
				Relation: "org",
				Object:   folderKey,
			}
			tupleKeys[orgFolderKey.User+orgFolderKey.Relation+orgFolderKey.Object] = orgFolderKey

			if folderRow.ParentUid != "" {
				parentFolderKey := &openfgav1.TupleKey{
					User:     parentFolderKey,
					Relation: "parent",
					Object:   folderKey,
				}
				tupleKeys[parentFolderKey.User+parentFolderKey.Relation+parentFolderKey.Object] = parentFolderKey
			}
		}

		return nil
	})
	if err != nil {
		return err
	}

	logger.Info("Synchronizing folder relations", "relations", len(tupleKeys))
	return batchWrite(ctx, tupleKeys, cl)
}

func (s *AccessControlStore) SyncDashboardRelations(ctx context.Context, cl *zclient.GRPCClient) error {
	tupleKeys := map[string]*openfgav1.TupleKey{}
	logger := log.New("accesscontrol.syncDashboardRelations")

	query := `SELECT id, uid, org_id, title, folder_uid FROM dashboard WHERE is_folder = 0`
	type dashboard struct {
		Id        int64  `xorm:"id"`
		Uid       string `xorm:"uid"`
		OrgId     int64  `xorm:"org_id"`
		Title     string `xorm:"title"`
		FolderUid string `xorm:"folder_uid"`
	}

	err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		rows, err := sess.SQL(query).Rows(new(dashboard))
		if err != nil {
			return err
		}
		defer func() {
			if err := rows.Close(); err != nil {
				logger.Error("Failed to close rows", "error", err)
			}
		}()

		for rows.Next() {
			dashboardRow := dashboard{}
			if err := rows.Scan(&dashboardRow); err != nil {
				return err
			}

			orgKey := "org:" + strconv.FormatInt(dashboardRow.OrgId, 10)
			dashboardKey := "dashboard:" + dashboardRow.Uid
			folderKey := "folder:" + dashboardRow.FolderUid

			// Define relations based on the org and parent folder
			orgDashboardKey := &openfgav1.TupleKey{
				User:     orgKey,
				Relation: "org",
				Object:   dashboardKey,
			}
			tupleKeys[orgDashboardKey.User+orgDashboardKey.Relation+orgDashboardKey.Object] = orgDashboardKey

			if dashboardRow.FolderUid != "" {
				parentDashboardKey := &openfgav1.TupleKey{
					User:     folderKey,
					Relation: "folder",
					Object:   dashboardKey,
				}
				tupleKeys[parentDashboardKey.User+parentDashboardKey.Relation+parentDashboardKey.Object] = parentDashboardKey
			}
		}

		return nil
	})
	if err != nil {
		return err
	}

	logger.Info("Synchronizing dashboard relations", "relations", len(tupleKeys))
	return batchWrite(ctx, tupleKeys, cl)
}
