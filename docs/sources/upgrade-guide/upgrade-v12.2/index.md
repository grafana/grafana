---
description: Guide for upgrading to Grafana v12.2
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '12.2'
title: Upgrade to Grafana v12.2
menuTitle: Upgrade to v12.2
weight: 498
---

# Upgrade to Grafana v12.2

{{< docs/shared lookup="upgrade/intro_2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Technical notes

### PostgreSQL annotation table migration

**Plan for increased disk usage when upgrading from Grafana v11.x**

Upgrading from Grafana v11.x to Grafana v12.x triggers a full-table rewrite of the PostgreSQL `annotation` table. The migration populates the new `dashboard_uid` column, which causes PostgreSQL to rewrite the entire table and rebuild its indexes.

Environments with large annotation datasets can experience significant temporary disk usage increase, which may lead to:

- Rapid disk consumption on the PostgreSQL data volume
- Database migration failures (for example, "could not extend file: No space left on device")
- Grafana startup failures
- Extended downtime during the upgrade process

#### How do I know if I'm affected?

You're affected if you're upgrading from Grafana v11.x to v12.x and you have a large `annotation` table in your PostgreSQL database.

To check your annotation table size, connect to your PostgreSQL database and run the following query:

```sql
SELECT
    pg_size_pretty(pg_relation_size('annotation'))       AS table_size,
    pg_size_pretty(pg_indexes_size('annotation'))        AS indexes_size,
    pg_size_pretty(pg_total_relation_size('annotation')) AS total_size;
```

If your total size is several gigabytes or more, you should plan accordingly before upgrading.

#### What should I do before upgrading?

Before you upgrade, take the following steps:

1. **Verify available disk space**: Ensure you have at least 2-3 times the current `annotation` table size available as free disk space on your PostgreSQL data volume.

2. **Review your annotation data**: Consider whether you need to retain all historical annotations.

3. **Clean up old annotations (optional)**: If you have annotations you don't need, remove them before upgrading.

4. **Back up your database**: Always back up your Grafana database before performing an upgrade. For more information, refer to [Back up Grafana](#back-up-grafana).

#### What should I do after upgrading?

After successfully upgrading to Grafana v12.x, you can reclaim disk space by running a `VACUUM FULL` operation on the `annotation` table during a maintenance window:

```sql
VACUUM FULL annotation;
```

This operation requires a lock on the table and may take significant time depending on the table size. Plan to run this during a low-traffic period.
