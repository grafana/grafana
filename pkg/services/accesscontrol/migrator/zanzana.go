package migrator

import (
	"context"
	"fmt"
	"strconv"
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

func NewZanzanaSynchroniser(client zanzana.Client, store db.DB, collectors ...TupleCollector) *ZanzanaSynchroniser {
	// Append shared collectors that is used by both enterprise and oss
	collectors = append(collectors, managedPermissionsCollector(store))

	return &ZanzanaSynchroniser{
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

// managedPermissionsCollector collectes managed permissions into provided tuple map.
// It will only store actions that are supported by our schema. Managed permissions can
// be directly mapped to user/team/role without having to write an intermediate role.
func managedPermissionsCollector(store db.DB) TupleCollector {
	return func(ctx context.Context, tuples map[string][]*openfgav1.TupleKey) error {
		const collectorID = "managed"
		const query = `
		SELECT ur.user_id, p.action, p.kind, p.identifier, r.org_id FROM permission p
		INNER JOIN role r on p.role_id = r.id
		LEFT JOIN user_role ur on r.id  = ur.role_id
		LEFT JOIN team_role tr on r.id  = tr.role_id
		LEFT JOIN builtin_role br on r.id  = br.role_id
		WHERE r.name LIKE 'managed:%'
	`
		type Permission struct {
			RoleName   string `xorm:"role_name"`
			OrgID      int64  `xorm:"org_id"`
			Action     string `xorm:"action"`
			Kind       string
			Identifier string
			UserID     int64 `xorm:"user_id"`
			TeamID     int64 `xorm:"user_id"`
		}

		var permissions []Permission
		err := store.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL(query).Find(&permissions)
		})

		if err != nil {
			return err
		}

		for _, p := range permissions {
			var subject string
			if p.UserID > 0 {
				subject = zanzana.NewObject(zanzana.TypeUser, strconv.FormatInt(p.UserID, 10))
			} else if p.TeamID > 0 {
				subject = zanzana.NewObject(zanzana.TypeTeam, strconv.FormatInt(p.TeamID, 10))
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
