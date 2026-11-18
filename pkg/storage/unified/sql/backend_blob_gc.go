package sql

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

func (b *backend) collectBlobs(ctx context.Context) {
	if b.blobGC == nil {
		var store resource.BlobGCStore
		var err error
		if b.blobURL != "" {
			var bucket resource.CDKBucket
			bucket, err = resource.OpenBlobBucket(ctx, b.blobURL)
			if err == nil {
				store = resource.NewCDKBlobGCStore(bucket, "")
			}
		} else {
			store, err = kv.NewSQLKV(b.db.SqlDB(), b.db.DriverName())
		}
		if err != nil {
			b.blobGCMetrics.Record(0, true, err)
			b.log.Error("initializing blob garbage collection", "error", err)
			return
		}
		b.blobGC = resource.NewBlobGarbageCollector(store, b.garbageCollection.BatchSize, b.garbageCollection.BatchWait)
	}
	dryRun := b.garbageCollection.DryRun || b.garbageCollection.BlobDryRun
	count, err := b.blobGC.Collect(ctx, time.Now(), b.garbageCollection.MaxAge, dryRun, b.blobReferenced)
	b.blobGCMetrics.Record(count, dryRun, err)
	if err != nil {
		b.log.Error("blob garbage collection failed", "error", err)
	}
	b.log.Info("blob garbage collection finished", "blobs", count, "dryRun", dryRun)
}

func (b *backend) blobReferenced(ctx context.Context, blob kv.BlobKey) (bool, error) {
	dialect, err := kv.DialectFromDriver(b.db.DriverName())
	if err != nil {
		return false, err
	}
	columns := []string{"group", "resource", "namespace", "name"}
	predicates := make([]string, len(columns))
	for i, column := range columns {
		predicates[i] = dialect.QuoteIdent(column) + " = " + dialect.Placeholder(i+1)
	}
	query := fmt.Sprintf("SELECT %s FROM %s WHERE %s", dialect.QuoteIdent("value"), dialect.QuoteIdent("resource_history"), strings.Join(predicates, " AND "))
	rows, err := b.db.SqlDB().QueryContext(ctx, query, blob.Group, blob.Resource, blob.Namespace, blob.Name)
	if err != nil {
		return false, err
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var value []byte
		if err := rows.Scan(&value); err != nil {
			return false, err
		}
		live, err := resource.ResourceReferencesBlob(value, blob.UID)
		if err != nil || live {
			return live, err
		}
	}
	return false, rows.Err()
}
