---
description: Guide for upgrading to Grafana v13.0
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '13.0'
title: Upgrade to Grafana v13.0
menuTitle: Upgrade to v13.0
weight: 496
---

# Upgrade to Grafana v13.0

{{< docs/shared lookup="upgrade/intro_2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Technical notes

### React 19 related updates

As part of our [migration in Grafana 13 to React 19](https://grafana.com/blog/react-19-is-coming-to-grafana-what-plugin-developers-need-to-know/#next-steps-and-how-to-learn-more) - we recommend you to follow this order of update flow to ensure that your plugins are working properly and you have no disruptions during Grafana 13 upgrade.

Follow this sequence for best results:

#### Upgrade your Grafana to latest patch version for the version you are running

To ensure that the changes required for the upgrade to React 19 are in place in your Grafana version, update to the latest minor version available for your Grafana instance. You can check the available versions on the [downloads page](https://grafana.com/grafana/download).

#### Update all of your plugins

To get the latest version of each installed plugin and increase the chance that it has all the necessary code updated to support React 19 - please update all of your installed plugins and check if they are still working properly.

#### Upgrade to Grafana 13

Finally you can continue your upgrade to Grafana 13.

### Deprecated data source APIs disabled

Data source APIs that reference data sources by numeric `id` have been deprecated since Grafana 9.
In Grafana 13, they're disabled by default.

#### You are affected if

You use data source API endpoints that reference data sources by numeric `id` rather than `uid`.

#### Migration

Update your API calls to reference data sources by `uid` instead of numeric `id`.
To temporarily re-enable the deprecated APIs, enable the `datasourceLegacyIdApi` feature flag.
Both the deprecated APIs and the feature toggle will be removed in a future release.

### Image Renderer plugin support removed

In Grafana 13, support for the Image Renderer plugin is removed.

#### You are affected if

You run the Image Renderer as a Grafana plugin.
After upgrading, the plugin no longer works for rendering screenshots or scheduled reports.

#### Migration

Deploy the image renderer as a separate service alongside Grafana.
For setup instructions, refer to [Set up image rendering](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/#set-up-image-rendering).

### Image Renderer default authentication changed to JWTs

The Image Renderer previously authenticated with Grafana using opaque tokens stored in the database when generating screenshots and PDFs. Grafana v13.0 enables the `renderAuthJWT` feature toggle by default, which switches authentication to stateless JSON Web Tokens (JWTs) that don't depend on the database.

#### Action required

After upgrading to Grafana v13.0, if you use the Image Renderer, you must set a `[rendering]renderer_token` in your Grafana configuration file to a value that isn't empty or the default value (`-`), and configure the Image Renderer with the same token value. Restart your Grafana instance for the changes to take effect.

For more information, refer to the [Image Renderer security configuration documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/#security).

#### Reverting to the previous behavior

After upgrading to Grafana v13.0, to revert to opaque token authentication, disable the feature toggle in your Grafana configuration file:

```ini
[feature_toggles]
renderAuthJWT = false
```

Restart your Grafana instance for the changes to take effect.

### Unified storage for folders and dashboards

Grafana v13.0 automatically migrates folders and dashboards from the legacy SQL database to unified storage on startup.
The migration runs once and is tracked in the `unifiedstorage_migration_log` table.

After the migration completes, the following legacy tables are deprecated:

- `dashboard`
- `dashboard_acl`
- `dashboard_provisioning`
- `dashboard_version`
- `dashboard_tag`
- `library_element_connection`
- `folder`

These tables will be removed in a future release.

If you downgrade to an earlier Grafana version after the migration, the older version reads the stale legacy tables and doesn't reflect changes made in unified storage.
To roll back, restore from the database backup you took before upgrading.

If you downgrade and then upgrade again without restoring a backup, any folders or dashboards created or modified during the downgrade aren't migrated automatically.
If a backup isn't available, contact Grafana support for assistance.

#### SQLite deployments

If you use SQLite, the migration might fail with `database is locked` or `database table is locked` errors due to lock contention.
Grafana automatically retries using the Parquet buffer, but if errors persist, increase `migration_cache_size_kb` or enable `migration_parquet_buffer` in the `[unified_storage]` section of your configuration file:

| Setting                    | Description                                                                                              | Default           |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| `migration_cache_size_kb`  | SQLite page cache size during migration.                                                                 | `1000000` (~1 GB) |
| `migration_parquet_buffer` | Stage data through a temporary Parquet file to separate read and write phases, avoiding lock contention. | `false`           |

### Removal of grafana-cli and grafana-server commands

The `grafana-cli` and `grafana-server` commands, deprecated since Grafana v10.0, are removed in Grafana v13.0.
Update any scripts, systemd units, Docker entrypoints, CI pipelines, or other automation to use `grafana cli` and `grafana server` instead.

### Legacy Alertmanager configuration API endpoints changed

Several legacy Alertmanager configuration API endpoints are removed or restricted in Grafana v13.0:

- `DELETE /api/alertmanager/grafana/config/api/v1/alerts` is removed.
- `POST /api/alertmanager/grafana/config/api/v1/receivers/test` is removed.
- `GET /api/alertmanager/grafana/config/api/v1/alerts` is restricted to admin users.
- `GET /api/alertmanager/grafana/config/history` is restricted to admin users.
- `POST /api/alertmanager/grafana/config/history/{id}/_activate` is restricted to admin users.

#### You are affected if

You call any of these endpoints in automation scripts, Terraform providers, or custom tooling.

#### Migration

Migrate to the Kubernetes-style resource APIs under `notifications.alerting.grafana.app/v1beta1`:

| Resource              | API path                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Receivers             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers`            |
| Notification policies | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/routingtrees`         |
| Templates             | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/templategroups`       |
| Mute timings          | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/timeintervals`        |
| Inhibition rules      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/inhibitionrules`      |
| Receiver testing      | `/apis/notifications.alerting.grafana.app/v1beta1/namespaces/{namespace}/receivers/{uid}/test` |
