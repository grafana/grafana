---
description: Guide for upgrading to Grafana v12.0
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '12.0'
title: Upgrade to Grafana v12.0
menuTitle: Upgrade to v12.0
weight: 500
---

# Upgrade to Grafana v12.0

{{< docs/shared lookup="upgrade/intro_2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Technical notes

### Grafana data source UID format enforcement

**Ensure that your data source UIDs follow the correct standard**

We've had standard ways to define UIDs for Grafana objects for years (at least [since Grafana v5](https://github.com/grafana/grafana/issues/7883)). While all of our internal code complies with this format, we haven't strictly enforced this format in REST APIs and provisioning paths that allow the creation and update of data sources.

In Grafana v11.1, we [introduced](https://github.com/grafana/grafana/pull/86598) a warning that is sent to Grafana server logs every time a data source instance is created or updated using an invalid UID format.

In Grafana v11.2, we [added](https://github.com/grafana/grafana/pull/89363/files) a new feature flag called `failWrongDSUID` that is turned off by default. When enabled, the REST APIs and provisioning reject any requests to create or update data source instances that have an incorrect UID.

In Grafana v12.0, we're turning the feature flag `failWrongDSUID` on by default.

#### Correct UID format

You can find the exact regex definition [in the `grafana/grafana` repository](https://github.com/grafana/grafana/blob/c92f5169d1c83508beb777f71a93336179fe426e/pkg/util/shortid_generator.go#L32-L45).

A data source UID can only contain:

- Latin characters (`a-Z`)
- Numbers (`0-9`)
- Dash symbols (`-`)

#### How do I know if I'm affected?

- You can fetch all your data sources using the `/api/datasources` API. Review the `uid` fields, comparing them to the correct format, as shown [in the docs](https://grafana.com/docs/grafana/latest/developers/http_api/data_source/#get-all-data-sources). The following script can help, but note that it's missing authentication that you [have to add yourself](https://grafana.com/docs/grafana/latest/developers/http_api/#authenticating-api-requests):

```
curl http://localhost:3000/api/datasources | jq '.[] | select((.uid | test("^[a-zA-Z0-9\\-_]+$") | not) or (.uid | length > 40)) | {id, uid, name, type}'
```

- Alternatively, you can check the server logs for the `Invalid datasource uid` [error](https://github.com/grafana/grafana/blob/68751ed3107c4d15d33f34b15183ee276611785c/pkg/services/datasources/service/store.go#L429).

#### What do I do if I'm affected?

You'll need to create a new data source with the correct UID and update your dashboards and alert rules to use it.

#### How do I update my dashboards to use the new or updated data source?

- Go to the dashboard using the data source and update it by selecting the new or updated data source from the picker below your panel.

OR

- Update the dashboard's JSON model directly using search and replace.

  Navigate to [dashboard json model](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/) and carefully replace all the instances of the old `uid` with the newly created `uid`.

  {{< figure src="/media/docs/grafana/screenshot-grafana-11-datasource-uid-enforcement.png" alt="Updating JSON Model of a Dashboard">}}

#### How do I update my alert rules to use the new or updated data source?

Open the alert rule you want to adjust and search for the data source that is being used for the query/alert condition. From there, select the new data source from the drop-down list and save the alert rule.

### Enforcing stricter version compatibility checks in plugin CLI install commands

Since Grafana 10.2, the endpoint to check compatible versions when installing a plugin using `grafana cli plugins install` changed, which led to Grafana dependency version no longer being taken into account. This might have led to some behavior where the CLI would install plugins that are not fully compatible based on the plugins definition of compatibility via `grafanaDependency` property in the `plugin.json` file.

#### What if I want to ignore the compatibility check?

We _do not_ recommend installing plugins declared as incompatible. However, if you need to force install a plugin despite it being declared as incompatible, refer to the [Installing a plugin from a ZIP](https://grafana.com/docs/grafana/latest/administration/plugin-management/#install-a-plugin-from-a-zip-file) guidance.

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
