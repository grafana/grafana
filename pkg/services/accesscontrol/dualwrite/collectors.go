package dualwrite

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func teamMembershipCollector(store db.DB) legacyTupleCollector {
	return func(ctx context.Context) (map[string]map[string]*openfgav1.TupleKey, error) {
		query := `
			SELECT t.uid as team_uid, u.uid as user_uid, tm.permission
			FROM team_member tm
			INNER JOIN team t ON tm.team_id = t.id
			INNER JOIN ` + store.GetDialect().Quote("user") + ` u ON tm.user_id = u.id
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
			return nil, err
		}

		tuples := make(map[string]map[string]*openfgav1.TupleKey)

		for _, m := range memberships {
			tuple := &openfgav1.TupleKey{
				User:   zanzana.NewTupleEntry(zanzana.TypeUser, m.UserUID, ""),
				Object: zanzana.NewTupleEntry(zanzana.TypeTeam, m.TeamUID, ""),
			}

			// Admin permission is 4 and member 0
			if m.Permission == 4 {
				tuple.Relation = zanzana.RelationTeamAdmin
			} else {
				tuple.Relation = zanzana.RelationTeamMember
			}

			if tuples[tuple.Object] == nil {
				tuples[tuple.Object] = make(map[string]*openfgav1.TupleKey)
			}

			tuples[tuple.Object][tuple.String()] = tuple
		}

		return tuples, nil
	}
}

func zanzanaCollector(client zanzana.Client, relations []string) zanzanaTupleCollector {
	return func(ctx context.Context, client zanzana.Client, object string) (map[string]*openfgav1.TupleKey, error) {
		// list will use continuation token to collect all tuples for object and relation
		list := func(relation string) ([]*openfgav1.Tuple, error) {
			first, err := client.Read(ctx, &openfgav1.ReadRequest{
				TupleKey: &openfgav1.ReadRequestTupleKey{
					Object:   object,
					Relation: relation,
				},
			})

			if err != nil {
				return nil, err
			}

			c := first.ContinuationToken

			for c != "" {
				res, err := client.Read(ctx, &openfgav1.ReadRequest{
					TupleKey: &openfgav1.ReadRequestTupleKey{
						Object:   object,
						Relation: relation,
					},
				})
				if err != nil {
					return nil, err
				}

				c = res.ContinuationToken
				first.Tuples = append(first.Tuples, res.Tuples...)
			}

			return first.Tuples, nil
		}

		out := make(map[string]*openfgav1.TupleKey)
		for _, r := range relations {
			tuples, err := list(r)
			if err != nil {
				return nil, err
			}
			for _, t := range tuples {
				out[t.Key.String()] = t.Key
			}
		}

		return out, nil
	}
}
