---
description: Guide for upgrading to Grafana v13.4
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '13.4'
title: Upgrade to Grafana v13.4
menuTitle: Upgrade to v13.4
weight: 491
---

# Upgrade to Grafana v13.4

{{< docs/shared lookup="upgrade/intro_2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Technical notes

### Annotation table migration

**Plan for a longer startup and increased disk usage when upgrading to Grafana v13.4**

Upgrading to Grafana v13.4 adds an `alert_uid` column and an index on `(org_id, alert_uid)` to the `annotation` table. Grafana builds the index during the database migrations it runs at startup, so on a large `annotation` table, Grafana takes longer to start. After startup, alerting fills in `alert_uid` on existing alert annotations in the background, which updates those rows.

On PostgreSQL, building the index also blocks inserts, updates, and deletes on the `annotation` table until the build finishes. During that time, other Grafana instances that share the database can't save annotations, including alert state changes recorded as annotations.

Environments with large annotation datasets can experience:

- Extended Grafana startup time while the index builds
- Blocked annotation writes during the index build on PostgreSQL
- Increased disk usage on the database data volume from the new index and the updated alert annotation rows
- Extended downtime during the upgrade process

#### How do I know if I'm affected?

You're affected if you have a large `annotation` table in your database.

To check your annotation table size, connect to your database and check the table size.

For PostgreSQL, run the following query:

```sql
SELECT
    pg_size_pretty(pg_relation_size('annotation'))       AS table_size,
    pg_size_pretty(pg_indexes_size('annotation'))        AS indexes_size,
    pg_size_pretty(pg_total_relation_size('annotation')) AS total_size;
```

For MySQL, run the following query:

```sql
SELECT
    ROUND(data_length / 1024 / 1024, 2) AS table_size_mb,
    ROUND(index_length / 1024 / 1024, 2) AS indexes_size_mb,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_size_mb
FROM information_schema.tables
WHERE table_schema = DATABASE()
    AND table_name = 'annotation';
```

For SQLite, check the database file size directly, as SQLite stores all tables in a single file. You can run the following command from your terminal:

```bash
ls -lh <PATH/TO/GRAFANA.DB>
```

If your total size is several gigabytes or more, you should plan accordingly before upgrading.

#### What should I do before upgrading?

Before you upgrade, take the following steps:

1. **Verify available disk space**: Ensure you have free disk space on your database data volume for the new index and for the updated alert annotation rows.

1. **Review your annotation data**: Consider whether you need to retain all historical annotations.

1. **Clean up old annotations (optional)**: If you have annotations you don't need, remove them before upgrading. A smaller table makes the index build faster.

1. **Create the column and index yourself on PostgreSQL (optional)**: To avoid blocking annotation writes during the upgrade, create the column and index before upgrading. For more information, refer to [Create the column and index before upgrading on PostgreSQL](#create-the-column-and-index-before-upgrading-on-postgresql).

1. **Back up your database**: Always back up your Grafana database before performing an upgrade. For more information, refer to [Back up Grafana](#back-up-grafana).

#### Create the column and index before upgrading on PostgreSQL

On PostgreSQL, you can create the `alert_uid` column and its index yourself while your current version of Grafana keeps running. Use `CREATE INDEX CONCURRENTLY` to build the index without blocking writes. When Grafana v13.4 starts, it finds that the column and index already exist and skips both migrations.

Grafana checks for the column and the index by name only. Use the exact names, types, and quoting in the following steps. Otherwise, Grafana creates a second index or the migration fails.

Before you begin, ensure you have the following:

- A PostgreSQL user that owns the `annotation` table, such as the user Grafana connects with.
- A client that runs each statement on its own, outside a transaction, such as `psql`. PostgreSQL doesn't allow `CREATE INDEX CONCURRENTLY` inside a transaction block.

To create the column and index, complete the following steps:

1. **Add the column**

   Adding a column takes a brief exclusive lock on the table. If a long-running query holds a lock on `annotation`, the `ALTER TABLE` waits, and other queries queue behind it. Set a lock timeout so the statement fails quickly instead, and retry it if it times out:

   ```sql
   SET lock_timeout = '5s';
   ALTER TABLE "annotation" ADD COLUMN "alert_uid" VARCHAR(253) NOT NULL DEFAULT '';
   ```

   The column has a constant default, so PostgreSQL adds it without rewriting the table. Your current version of Grafana ignores the new column.

1. **Build the index concurrently**

   `CREATE INDEX CONCURRENTLY` takes longer than a regular index build, and it waits for transactions that are already running on the database to finish before it completes.

   Run the following statement. Keep the double quotes around the index name, because the name is case-sensitive:

   ```sql
   CREATE INDEX CONCURRENTLY "IDX_annotation_org_id_alert_uid" ON "annotation" ("org_id", "alert_uid");
   ```

1. **Verify the index is valid**

   If a concurrent index build fails or is canceled, PostgreSQL leaves an invalid index behind. Grafana checks only whether the index exists, not whether it's valid, so it would skip the migration and keep the invalid index.

   Run the following query and confirm that `indisvalid` is `t`:

   ```sql
   SELECT indexrelid::regclass AS index_name, indisvalid
   FROM pg_index
   WHERE indexrelid = '"IDX_annotation_org_id_alert_uid"'::regclass;
   ```

   If `indisvalid` is `f`, drop the index and repeat the previous step:

   ```sql
   DROP INDEX CONCURRENTLY "IDX_annotation_org_id_alert_uid";
   ```

1. **Upgrade Grafana**

   Upgrade to Grafana v13.4. During startup, the Grafana server log shows the following message for both the `Add alert_uid column to annotation table` and the `Add index for org_id_alert_uid on annotation table` migrations:

   ```text
   Skipping migration: Already executed, but not recorded in migration log
   ```

#### What should I do after upgrading?

After upgrading to Grafana v13.4, alerting fills in `alert_uid` on existing alert annotations in the background, in batches. This doesn't block Grafana. If Grafana restarts before it finishes, it continues on the next startup.

To check how many alert annotations are still waiting, run the following query:

```sql
SELECT count(*) FROM annotation WHERE alert_id > 0 AND alert_uid = '';
```

When the query returns `0`, you can reclaim disk space from the updated rows by performing database maintenance operations during a maintenance window.

For PostgreSQL, run a `VACUUM FULL` operation on the `annotation` table:

```sql
VACUUM FULL annotation;
```

For MySQL, run an `OPTIMIZE TABLE` operation on the `annotation` table:

```sql
OPTIMIZE TABLE annotation;
```

For SQLite, run a `VACUUM` operation on the database:

```sql
VACUUM;
```

These operations require a lock on the table and may take significant time depending on the table size. Plan to run these during a low-traffic period.
