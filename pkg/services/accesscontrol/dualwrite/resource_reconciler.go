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
	name               string
	legacy             legacyTupleCollector
	zanzana            zanzanaTupleCollector
	client             zanzana.Client
	orphanObjectPrefix string
	orphanRelations    []string
}

func newResourceReconciler(name string, legacy legacyTupleCollector, zanzanaCollector zanzanaTupleCollector, client zanzana.Client) resourceReconciler {
	r := resourceReconciler{name: name, legacy: legacy, zanzana: zanzanaCollector, client: client}

	// we only need to worry about orphaned tuples for reconcilers that use the managed permissions collector (i.e. dashboards & folders)
	switch name {
	case "managed folder permissions":
		// prefix for folders is `folder:`
		r.orphanObjectPrefix = fmt.Sprintf("%s:", zanzana.TypeFolder)
		r.orphanRelations = append([]string{}, zanzana.RelationsFolder...)
	case "managed dashboard permissions":
		// prefix for dashboards will be `resource:dashboard.grafana.app/dashboards/`
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

	// 0. Fetch all tuples currently stored in Zanzana. This will be used later on
	// to cleanup orphaned tuples.
	// This order needs to be kept (fetching from Zanzana first) to avoid accidentally
	// cleaning up new tuples that were added after the legacy tuples were fetched.
	allTuplesInZanzana, err := r.readAllTuples(ctx, namespace)
	if err != nil {
		return fmt.Errorf("failed to read all tuples from zanzana for %s: %w", r.name, err)
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

	// when the last managed permission for a resource is removed, the legacy results will no
	// longer contain any tuples for that resource. this process cleans it up when applicable.
	orphans, err := r.collectOrphanDeletes(ctx, namespace, allTuplesInZanzana, res)
	if err != nil {
		return fmt.Errorf("failed to collect orphan deletes (%s): %w", r.name, err)
	}
	deletes = append(deletes, orphans...)

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

// collectOrphanDeletes collects tuples that are no longer present in the legacy results
// but still are present in zanzana. when that is the case, we need to delete the tuple from
// zanzana. this will happen when the last managed permission for a resource is removed.
// this is only used for dashboards and folders, as those are the only resources that use the managed permissions collector.
func (r resourceReconciler) collectOrphanDeletes(
	ctx context.Context,
	namespace string,
	allTuplesInZanzana []*authzextv1.Tuple,
	legacyReturnedTuples map[string]map[string]*openfgav1.TupleKey,
) ([]*openfgav1.TupleKeyWithoutCondition, error) {
	if r.orphanObjectPrefix == "" || len(r.orphanRelations) == 0 {
		return []*openfgav1.TupleKeyWithoutCondition{}, nil
	}

	seen := map[string]struct{}{}
	out := []*openfgav1.TupleKeyWithoutCondition{}

	// what relation types we are interested in cleaning up
	relationsToCleanup := map[string]struct{}{}
	for _, rel := range r.orphanRelations {
		relationsToCleanup[rel] = struct{}{}
	}

	for _, tuple := range allTuplesInZanzana {
		if tuple == nil || tuple.Key == nil {
			continue
		}
		// only cleanup the particular relation types we are interested in
		if _, ok := relationsToCleanup[tuple.Key.Relation]; !ok {
			continue
		}
		// only cleanup the particular object types we are interested in (either dashboards or folders)
		if !strings.HasPrefix(tuple.Key.Object, r.orphanObjectPrefix) {
			continue
		}
		// if legacy returned this object, it's not orphaned
		if _, ok := legacyReturnedTuples[tuple.Key.Object]; ok {
			continue
		}
		// keep track of the tuples we have already seen and marked for deletion
		key := fmt.Sprintf("%s|%s|%s", tuple.Key.User, tuple.Key.Relation, tuple.Key.Object)
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
