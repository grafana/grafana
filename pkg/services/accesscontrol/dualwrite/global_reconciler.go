package dualwrite

import (
	"context"
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

type globalTupleCollector func(ctx context.Context) (map[string]map[string]*openfgav1.TupleKey, error)

type globalReconciler struct {
	name            string
	globalCollector globalTupleCollector
	zanzana         zanzanaTupleCollector
	client          zanzana.Client
}

func newGlobalReconciler(name string, globalCollector globalTupleCollector, zanzana zanzanaTupleCollector, client zanzana.Client) globalReconciler {
	return globalReconciler{name, globalCollector, zanzana, client}
}

func (r globalReconciler) reconcile(ctx context.Context) error {
	namespace := zanzana.ClusterNamespace

	// 1. Fetch grafana resources stored in grafana db.
	res, err := r.globalCollector(ctx)
	if err != nil {
		return fmt.Errorf("failed to collect legacy tuples for %s: %w", r.name, err)
	}

	var (
		writes  = []*openfgav1.TupleKey{}
		deletes = []*openfgav1.TupleKeyWithoutCondition{}
	)

	for object, tuples := range res {
		// 2. Fetch all tuples for given object.
		// Due to limitations in open fga api we need to collect tuples per object
		zanzanaTuples, err := r.zanzana(ctx, r.client, object, namespace)
		if err != nil {
			return fmt.Errorf("failed to collect zanzanaa tuples for %s: %w", r.name, err)
		}

		// 3. Check if tuples from grafana db exists in zanzana and if not add them to writes
		for key, t := range tuples {
			stored, ok := zanzanaTuples[key]
			if !ok {
				writes = append(writes, t)
				continue
			}

			// 4. For folder resource tuples we also need to compare the stored group_resources
			if zanzana.IsFolderResourceTuple(t) && t.String() != stored.String() {
				deletes = append(deletes, &openfgav1.TupleKeyWithoutCondition{
					User:     t.User,
					Relation: t.Relation,
					Object:   t.Object,
				})

				writes = append(writes, t)
			}
		}

		// 5. Check if tuple from zanzana don't exists in grafana db, if not add them to deletes.
		for key, tuple := range zanzanaTuples {
			_, ok := tuples[key]
			if !ok {
				deletes = append(deletes, &openfgav1.TupleKeyWithoutCondition{
					User:     tuple.User,
					Relation: tuple.Relation,
					Object:   tuple.Object,
				})
			}
		}
	}

	if len(writes) == 0 && len(deletes) == 0 {
		return nil
	}

	if len(deletes) > 0 {
		err := batch(deletes, 100, func(items []*openfgav1.TupleKeyWithoutCondition) error {
			return r.client.Write(ctx, &authzextv1.WriteRequest{
				Namespace: namespace,
				Deletes:   &authzextv1.WriteRequestDeletes{TupleKeys: zanzana.ToAuthzExtTupleKeysWithoutCondition(items)},
			})
		})

		if err != nil {
			return err
		}
	}

	if len(writes) > 0 {
		err := batch(writes, 100, func(items []*openfgav1.TupleKey) error {
			return r.client.Write(ctx, &authzextv1.WriteRequest{
				Namespace: namespace,
				Writes:    &authzextv1.WriteRequestWrites{TupleKeys: zanzana.ToAuthzExtTupleKeys(items)},
			})
		})

		if err != nil {
			return err
		}
	}

	return nil
}
