package migrator

import (
	"context"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// A TupleCollector is responsible to build and store [openfgav1.TupleKey] into provided tuple map.
// They key used should be a unique group key for the collector so we can skip over an already synced group.
type TupleCollector func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error

// ZanzanaSynchroniser is a component to sync RBAC permissions to zanzana.
// We should rewrite the migration after we have "migrated" all possible actions
// into our schema. This will only do a one time migration for each action so its
// is not really syncing the full rbac state. If a fresh sync is needed the tuple
// needs to be cleared first.
type ZanzanaSynchroniser struct {
	log        log.Logger
	client     zanzana.Client
	collectors []TupleCollector
}

func NewZanzanaSynchroniser(client zanzana.Client, store db.ReplDB, collectors ...TupleCollector) *ZanzanaSynchroniser {
	// Append shared collectors that is used by both enterprise and oss
	collectors = append(
		collectors,
		teamMembershipCollector(store.DB()),
		managedPermissionsCollector(store),
	)

	return &ZanzanaSynchroniser{
		client:     client,
		log:        log.New("zanzana.sync"),
		collectors: collectors,
	}
}

// Sync runs all collectors and tries to write all collected tuples.
// It will skip over any "sync group" that has already been written.
func (z *ZanzanaSynchroniser) Sync(ctx context.Context) error {
	tuplesMap := make(map[string][]*openfgav1.TupleKey)

	for _, c := range z.collectors {
		if err := c(ctx, tuplesMap); err != nil {
			return fmt.Errorf("failed to collect permissions: %w", err)
		}
	}

	for key, tuples := range tuplesMap {
		if err := batch(len(tuples), 100, func(start, end int) error {
			return z.client.Write(ctx, &openfgav1.WriteRequest{
				Writes: &openfgav1.WriteRequestWrites{
					TupleKeys: tuples[start:end],
				},
			})
		}); err != nil {
			if strings.Contains(err.Error(), "cannot write a tuple which already exists") {
				z.log.Debug("Skipping already synced permissions", "sync_key", key)
				continue
			}
			return err
		}
	}

	return nil
}

// managedPermissionsCollector collects managed permissions into provided tuple map.
// It will only store actions that are supported by our schema. Managed permissions can
// be directly mapped to user/team/role without having to write an intermediate role.
func managedPermissionsCollector(store db.ReplDB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "managed"
		const query = `
			SELECT u.uid as user_uid, t.uid as team_uid, p.action, p.kind, p.identifier, r.org_id
			FROM permission p
			INNER JOIN role r ON p.role_id = r.id
			LEFT JOIN user_role ur ON r.id = ur.role_id
			LEFT JOIN user u ON u.id = ur.user_id
			LEFT JOIN team_role tr ON r.id = tr.role_id
			LEFT JOIN team t ON tr.team_id = t.id
			LEFT JOIN builtin_role br ON r.id  = br.role_id
			WHERE r.name LIKE 'managed:%'
		`
		type Permission struct {
			RoleName   string `xorm:"role_name"`
			OrgID      int64  `xorm:"org_id"`
			Action     string `xorm:"action"`
			Kind       string
			Identifier string
			UserUID    string `xorm:"user_uid"`
			TeamUID    string `xorm:"team_uid"`
		}

		var permissions []Permission
		err := store.DB().WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&permissions)
		})

		if err != nil {
			return err
		}

		for _, p := range permissions {
			var subject string
			if len(p.UserUID) > 0 {
				subject = zanzana.NewObject(zanzana.TypeUser, p.UserUID)
			} else if len(p.TeamUID) > 0 {
				subject = zanzana.NewObject(zanzana.TypeTeam, p.TeamUID)
			} else {
				// FIXME(kalleep): Unsuported role binding (org role). We need to have basic roles in place
				continue
			}

			tuple, ok := zanzana.TranslateToTuple(subject, p.Action, p.Kind, p.Identifier, p.OrgID)
			if !ok {
				continue
			}

			// our "sync key" is a combination of collectorID and action so we can run this
			// sync new data when more actions are supported
			key := fmt.Sprintf("%s-%s", collectorID, p.Action)
			tuples[key] = append(tuples[key], tuple)
		}

		return nil
	}
}

func teamMembershipCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "team_membership"
		const query = `
			SELECT t.uid as team_uid, u.uid as user_uid, tm.permission
			FROM team_member tm
			INNER JOIN team t ON tm.team_id = t.id
			INNER JOIN user u ON tm.user_id = u.id
		`

		type membership struct {
			TeamUID    string `xorm:"team_uid"`
			UserUID    string `xorm:"user_uid"`
			Permission int
		}

		var memberships []membership
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&memberships)
		})

		if err != nil {
			return err
		}

		for _, m := range memberships {
			tuple := &openfgav1.TupleKey{
				User:   zanzana.NewObject(zanzana.TypeUser, m.UserUID),
				Object: zanzana.NewObject(zanzana.TypeTeam, m.TeamUID),
			}

			// Admin permission is 4 and member 0
			if m.Permission == 4 {
				tuple.Relation = zanzana.RelationTeamAdmin
			} else {
				tuple.Relation = zanzana.RelationTeamMember
			}

			tuples[collectorID] = append(tuples[collectorID], tuple)
		}

		return nil
	}
}
