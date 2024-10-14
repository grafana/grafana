package dualwrite

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// LegacyTupleCollector collects tuples groupd by object and tupleKey
type LegacyTupleCollector func(ctx context.Context) (map[string]map[string]*openfgav1.TupleKey, error)

// ZanzanaTupleCollector collects tuples from zanzana for given object
type ZanzanaTupleCollector func(ctx context.Context, client zanzana.Client, object string) (map[string]*openfgav1.TupleKey, error)

type resourceReconciler struct {
	name    string
	legacy  LegacyTupleCollector
	zanzana ZanzanaTupleCollector
	client  zanzana.Client
}

func newResourceReconciler(name string, legacy LegacyTupleCollector, zanzana ZanzanaTupleCollector, client zanzana.Client) resourceReconciler {
	return resourceReconciler{name, legacy, zanzana, client}
}

func (r resourceReconciler) reconcile(ctx context.Context) error {
	// 1. Fetch grafana resoruces stored in grafana db.
	res, err := r.legacy(ctx)
	if err != nil {
		return fmt.Errorf("failed to collect legacy tuples for %s: %w", r.name, err)
	}

	var (
		writes  = []*openfgav1.TupleKey{}
		deletes = []*openfgav1.TupleKeyWithoutCondition{}
	)

	for object, tuples := range res {
		zanzanaTuples, err := r.zanzana(ctx, r.client, object)
		if err != nil {
			return fmt.Errorf("failed to collect zanzanaa tuples for %s: %w", r.name, err)
		}

		for key, t := range tuples {
			_, ok := zanzanaTuples[key]
			if !ok {
				writes = append(writes, t)
			}
		}

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

	req := &openfgav1.WriteRequest{}

	if len(writes) > 0 {
		req.Writes = &openfgav1.WriteRequestWrites{TupleKeys: writes}
	}

	if len(deletes) > 0 {
		req.Deletes = &openfgav1.WriteRequestDeletes{TupleKeys: deletes}
	}

	return r.client.Write(ctx, req)
}
