package dualwrite

import (
	"context"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	claims "github.com/grafana/authlib/types"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// legacyTupleCollector collects tuples groupd by object and tupleKey
type legacyTupleCollector func(ctx context.Context, orgID int64) (map[string]map[string]*openfgav1.TupleKey, error)

// zanzanaTupleCollector collects tuples from zanzana for given object
type zanzanaTupleCollector func(ctx context.Context, client zanzana.Client, object string, namespace string) (map[string]*openfgav1.TupleKey, error)

type resourceReconciler struct {
	name    string
	legacy  legacyTupleCollector
	zanzana zanzanaTupleCollector
	client  zanzana.Client

	// orphan cleanup (used for managed permissions only) - when the last managed permission for an object is removed,
	// the DB collector stops returning that object, so the per-object reconciliation loop never runs and stale tuples can remain in Zanzana.
	// we use this cleanup to remove those stale tuples from Zanzana.
	orphanObjectPrefix string
	orphanRelations    []string
}

func newResourceReconciler(name string, legacy legacyTupleCollector, zanzanaCollector zanzanaTupleCollector, client zanzana.Client) resourceReconciler {
	r := resourceReconciler{name: name, legacy: legacy, zanzana: zanzanaCollector, client: client}

	// only enable orphan cleanup for the managed-permissions reconcilers
	switch name {
	case "managed folder permissions":
		// prefix looks like `folder:`
		r.orphanObjectPrefix = zanzana.TypeFolder + ":"
		r.orphanRelations = append([]string{}, zanzana.RelationsFolder...)
	case "managed dashboard permissions":
		// prefix looks like `resource:dashboard.grafana.app/dashboards/`
		r.orphanObjectPrefix = zanzana.NewObjectEntry(zanzana.TypeResource, "dashboard.grafana.app", "dashboards", "", "") + "/"
		r.orphanRelations = append([]string{}, zanzana.RelationsResouce...)
	}

	return r
}

func (r resourceReconciler) reconcile(ctx context.Context, namespace string) error {
	info, err := claims.ParseNamespace(namespace)
	if err != nil {
		return err
	}

	// 1. Fetch grafana resources stored in grafana db.
	res, err := r.legacy(ctx, info.OrgID)
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

			// 4. For folder resource tuples we also need to compare the stored subresources
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

	// remove stale managed-permission tuples for objects that disappeared from legacy output
	// (needed when the last managed permission for a resource is removed)
	if r.orphanObjectPrefix != "" && len(r.orphanRelations) > 0 {
		orphans, err := r.collectOrphanDeletes(ctx, namespace, res)
		if err != nil {
			return fmt.Errorf("failed to collect orphan deletes (%s): %w", r.name, err)
		}
		deletes = append(deletes, orphans...)
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

func (r resourceReconciler) collectOrphanDeletes(
	ctx context.Context,
	namespace string,
	legacy map[string]map[string]*openfgav1.TupleKey,
) ([]*openfgav1.TupleKeyWithoutCondition, error) {
	seen := map[string]struct{}{}
	out := []*openfgav1.TupleKeyWithoutCondition{}

	// OpenFGA does not support "filter by relation only" with an empty object
	// so we have to list all tuples (paginated) and filter them in-memory
	all, err := r.readAllTuples(ctx, namespace)
	if err != nil {
		return nil, err
	}

	allowedRel := map[string]struct{}{}
	for _, rel := range r.orphanRelations {
		allowedRel[rel] = struct{}{}
	}

	for _, tuple := range all {
		if tuple == nil || tuple.Key == nil {
			continue
		}
		if _, ok := allowedRel[tuple.Key.Relation]; !ok {
			continue
		}
		if !strings.HasPrefix(tuple.Key.Object, r.orphanObjectPrefix) {
			continue
		}
		// if legacy still has this object, it's not orphaned
		if _, ok := legacy[tuple.Key.Object]; ok {
			continue
		}
		key := tuple.Key.User + "|" + tuple.Key.Relation + "|" + tuple.Key.Object
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, &openfgav1.TupleKeyWithoutCondition{
			User:     tuple.Key.User,
			Relation: tuple.Key.Relation,
			Object:   tuple.Key.Object,
		})
	}

	return out, nil
}

func (r resourceReconciler) readAllTuples(ctx context.Context, namespace string) ([]*authzextv1.Tuple, error) {
	var (
		out           []*authzextv1.Tuple
		continueToken string
	)
	for {
		res, err := r.client.Read(ctx, &authzextv1.ReadRequest{
			Namespace:         namespace,
			ContinuationToken: continueToken,
		})
		if err != nil {
			return nil, err
		}
		out = append(out, res.Tuples...)
		continueToken = res.ContinuationToken
		if continueToken == "" {
			return out, nil
		}
	}
}
