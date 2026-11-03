package migrations

import (
	"context"
	"iter"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// CountUnifiedResourcesSQLite counts current resources in the migration's transaction.
func CountUnifiedResourcesSQLite(ctx context.Context, sess *xorm.Session, key resource.ListRequestKey, enableSQLKVBackend bool) (int64, error) {
	if !enableSQLKVBackend {
		return sess.Table("resource").
			Where("namespace = ? AND `group` = ? AND resource = ?", key.Namespace, key.Group, key.Resource).
			Count()
	}

	var count int64
	for _, err := range listUnifiedResourceKeysSQLite(ctx, sess, key) {
		if err != nil {
			return 0, err
		}
		count++
	}
	return count, nil
}

// SQLite migrations have not committed yet, so RPC reads on other connections
// cannot see their writes. Read the authoritative KV keys through the migration
// transaction; the legacy resource table is not maintained with compatibility off.
func listUnifiedResourceKeysSQLite(ctx context.Context, sess *xorm.Session, key resource.ListRequestKey) iter.Seq2[resource.DataKey, error] {
	return func(yield func(resource.DataKey, error) bool) {
		store, err := kv.NewSQLKV(sess.DB().DB, migrator.SQLite)
		if err != nil {
			yield(resource.DataKey{}, err)
			return
		}
		tx, err := sess.Tx()
		if err != nil {
			yield(resource.DataKey{}, err)
			return
		}
		ctx := kv.ContextWithDBTX(ctx, tx.Tx)
		prefix := key.Prefix()
		var latest resource.DataKey
		emit := func() bool {
			return latest.Name == "" || latest.Action == resource.DataActionDeleted || yield(latest, nil)
		}
		for raw, err := range store.Keys(ctx, kv.DataSection, kv.ListOptions{
			StartKey: prefix,
			EndKey:   kv.PrefixRangeEnd(prefix),
			Sort:     kv.SortOrderAsc,
		}) {
			if err != nil {
				yield(resource.DataKey{}, err)
				return
			}
			parsed, err := resource.ParseKey(raw)
			if err != nil {
				yield(resource.DataKey{}, err)
				return
			}
			if parsed.Name != latest.Name {
				if !emit() {
					return
				}
				latest = parsed
			} else if parsed.ResourceVersion >= latest.ResourceVersion {
				latest = parsed
			}
		}
		emit()
	}
}
