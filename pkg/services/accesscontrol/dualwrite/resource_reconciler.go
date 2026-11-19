package dualwrite

import (
	"context"
	"fmt"
	"slices"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	claims "github.com/grafana/authlib/types"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
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
	// protected collect the tuples other reconcilers write to the same objects
	// and relations. This reconciler never deletes one of them, and merges their
	// subresource filters into its own folder resource tuples, or each
	// reconciler would undo what the other wrote on every cycle.
	protected []legacyTupleCollector
}

// withProtected returns r, never deleting a tuple that one of collectors
// returns, and writing folder resource tuples with the filters of both.
func (r resourceReconciler) withProtected(collectors ...legacyTupleCollector) resourceReconciler {
	r.protected = append(append([]legacyTupleCollector{}, r.protected...), collectors...)
	return r
}

func newResourceReconciler(name string, legacy legacyTupleCollector, zanzanaCollector zanzanaTupleCollector, client zanzana.Client) resourceReconciler {
	r := resourceReconciler{name: name, legacy: legacy, zanzana: zanzanaCollector, client: client}

	// we only need to worry about orphaned tuples for reconcilers that use the managed permissions collector (i.e. dashboards & folders)
	switch name {
	case "managed folder permissions":
		// prefix for folders is `folder:`
		r.orphanObjectPrefix = zanzana.NewObjectEntry(zanzana.TypeFolder, "", "", "", "")
		r.orphanRelations = append([]string{}, zanzana.RelationsFolder...)
	case "managed dashboard permissions":
		// prefix for dashboards will be `resource:dashboard.grafana.app/dashboards/`
		r.orphanObjectPrefix = fmt.Sprintf("%s/", zanzana.NewObjectEntry(zanzana.TypeResource, dashboardV1.APIGroup, dashboardV1.DASHBOARD_RESOURCE, "", ""))
		r.orphanRelations = append([]string{}, zanzana.RelationsResouce...)
	}

	return r
}

func (r resourceReconciler) reconcile(ctx context.Context, namespace string) error {
	ctx, span := tracer.Start(ctx, "accesscontrol.dualwrite.resourceReconciler.reconcile",
		trace.WithAttributes(attribute.String("namespace", namespace)),
		trace.WithAttributes(attribute.String("reconciler", r.name)),
	)
	defer span.End()

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
	legacyCtx, legacySpan := tracer.Start(ctx, "accesscontrol.dualwrite.resourceReconciler.legacyCollector",
		trace.WithAttributes(attribute.String("namespace", namespace)),
		trace.WithAttributes(attribute.String("reconciler", r.name)),
	)
	res, err := r.legacy(legacyCtx, info.OrgID)
	legacySpan.End()
	if err != nil {
		return fmt.Errorf("failed to collect legacy tuples for %s: %w", r.name, err)
	}

	protected, err := r.collectProtected(ctx, info.OrgID)
	if err != nil {
		return fmt.Errorf("failed to collect protected tuples for %s: %w", r.name, err)
	}
	mergeProtectedFilters(res, protected)

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

	deletes = withoutProtected(deletes, writes, protected)

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

// tupleKey identifies a tuple by subject, relation and object, which is how
// Zanzana stores it: one tuple per key, whatever its condition.
func tupleKey(user, relation, object string) string {
	return user + "|" + relation + "|" + object
}

// collectProtected returns the tuples the protected collectors return, by
// tupleKey. Folder resource tuples for the same key are merged into one, with
// both filters. It returns nil when nothing is protected.
func (r resourceReconciler) collectProtected(ctx context.Context, orgID int64) (map[string]*openfgav1.TupleKey, error) {
	if len(r.protected) == 0 {
		return nil, nil
	}
	out := map[string]*openfgav1.TupleKey{}
	for _, collect := range r.protected {
		res, err := collect(ctx, orgID)
		if err != nil {
			return nil, err
		}
		for _, tuples := range res {
			for _, t := range tuples {
				k := tupleKey(t.User, t.Relation, t.Object)
				if seen, ok := out[k]; ok && zanzana.IsFolderResourceTuple(t) && zanzana.IsFolderResourceTuple(seen) {
					zanzana.MergeFolderResourceTuples(seen, t)
					continue
				}
				out[k] = proto.Clone(t).(*openfgav1.TupleKey)
			}
		}
	}
	return out, nil
}

// mergeProtectedFilters gives each of res's folder resource tuples the
// subresource filters of the protected tuple with the same key, sorted and
// without duplicates. Every reconciler sharing the tuple then writes the same
// one, instead of replacing the others' filters with its own on each cycle.
func mergeProtectedFilters(res map[string]map[string]*openfgav1.TupleKey, protected map[string]*openfgav1.TupleKey) {
	if protected == nil {
		return
	}
	for _, tuples := range res {
		for key, t := range tuples {
			if !zanzana.IsFolderResourceTuple(t) {
				continue
			}
			merged := proto.Clone(t).(*openfgav1.TupleKey)
			if p, ok := protected[tupleKey(t.User, t.Relation, t.Object)]; ok && zanzana.IsFolderResourceTuple(p) {
				zanzana.MergeFolderResourceTuples(merged, p)
			}
			normalizeSubresources(merged)
			tuples[key] = merged
		}
	}
}

// normalizeSubresources sorts a folder resource tuple's subresource filter and
// drops duplicates, so tuples merged in a different order compare equal.
func normalizeSubresources(t *openfgav1.TupleKey) {
	if t.Condition == nil || t.Condition.Context == nil {
		return
	}
	list := t.Condition.Context.Fields["subresources"].GetListValue()
	if list == nil {
		return
	}
	seen := map[string]struct{}{}
	values := make([]*structpb.Value, 0, len(list.Values))
	for _, v := range list.Values {
		if _, ok := seen[v.GetStringValue()]; ok {
			continue
		}
		seen[v.GetStringValue()] = struct{}{}
		values = append(values, v)
	}
	slices.SortFunc(values, func(a, b *structpb.Value) int {
		return strings.Compare(a.GetStringValue(), b.GetStringValue())
	})
	list.Values = values
}

// withoutProtected drops the deletes of tuples another reconciler writes. A
// delete this reconciler pairs with a write of the same tuple, to replace its
// subresources, is kept, since the write would otherwise conflict.
func withoutProtected(
	deletes []*openfgav1.TupleKeyWithoutCondition,
	writes []*openfgav1.TupleKey,
	protected map[string]*openfgav1.TupleKey,
) []*openfgav1.TupleKeyWithoutCondition {
	if len(deletes) == 0 || len(protected) == 0 {
		return deletes
	}
	written := map[string]struct{}{}
	for _, t := range writes {
		written[tupleKey(t.User, t.Relation, t.Object)] = struct{}{}
	}
	out := deletes[:0]
	for _, d := range deletes {
		k := tupleKey(d.User, d.Relation, d.Object)
		if _, ok := protected[k]; ok {
			if _, rewritten := written[k]; !rewritten {
				continue
			}
		}
		out = append(out, d)
	}
	return out
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
	ctx, span := tracer.Start(ctx, "accesscontrol.dualwrite.resourceReconciler.zanzana.readAllTuples",
		trace.WithAttributes(attribute.String("namespace", namespace)),
		trace.WithAttributes(attribute.String("reconciler", r.name)),
	)
	defer span.End()

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
