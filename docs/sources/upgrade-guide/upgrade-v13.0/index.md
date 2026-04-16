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
weight: 495
---

# Upgrade to Grafana v13.0

{{< docs/shared lookup="upgrade/intro_2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Technical notes

{{< admonition type="warning" >}}
**GitSync early adopters:** If you upgraded to Grafana v13.0.0 with GitSync enabled from Grafana v12.x.x, a migration bug might have caused dashboards and folders to be lost or reverted during the upgrade. This issue is fixed in Grafana v13.0.1.

This bug only affects self-managed instances that enabled the GitSync feature flags (`provisioning`, `kubernetesClientDashboardsFolders`, `kubernetesDashboards`, and `grafanaAPIServerEnsureKubectlAccess`) before GitSync reached general availability.

Grafana v13.0.0 was removed from distribution and a fix is included in Grafana v13.0.1.

If you are affected, recovery might require restoring from backup or resyncing from Git, depending on whether your instance used mixed local and GitSync content or full-instance sync. 

We recommend using your database backup to restore and then upgrading to v13.0.1.
{{< /admonition >}}

### React 19 related updates

As part of [the migration to React 19 in Grafana 13](https://grafana.com/blog/react-19-is-coming-to-grafana-what-plugin-developers-need-to-know/#next-steps-and-how-to-learn-more), make the following updates to ensure that your plugins are working properly and you don't experience any disruptions during the Grafana 13 upgrade.

Follow this sequence for best results:

#### Upgrade your Grafana to latest patch version for the version you are running

To ensure that the changes required for the upgrade to React 19 are in place in your Grafana version, update to the latest minor version available for your Grafana instance. You can check the available versions on the [downloads page](https://grafana.com/grafana/download).

#### Update all of your plugins

Update all of your installed plugins and check if they are still working properly. By using the latest version of a plugin you facilitate support to React 19.

#### Upgrade to Grafana 13

Finally you can continue your upgrade to Grafana 13.

### Legacy `/api` endpoints are now deprecated

The new Kubernetes-style API for dashboards, folders, and annotations is generally available in Grafana v13.0. The legacy `/api` endpoints are deprecated and will be removed in a future major release.

The new API is built on the Grafana App Platform (Kubernetes resource model) and provides versioned, consistent, and schema-based endpoints. The legacy `/api` endpoints remain functional but won't receive new features.

#### Namespace values

The new API paths include a `{namespace}` parameter. The value depends on your deployment type:

- **Grafana Cloud:** Your stack slug (for example, `my-stack`).
- **Grafana OSS / Enterprise:** Your org ID (for example, `org-1`).

#### Dashboards

The dashboards API is deprecated in Grafana v13.0. The new v1 API is available now.

New API reference: `{your-instance}/swagger?api=dashboard.grafana.app-v1`

| Operation          | Legacy endpoint                          | New endpoint                                                                                                                                                                                                                                                                                                           |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Get dashboard      | `GET /api/dashboards/uid/{uid}`          | `GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}`                                                                                                                                                                                                                                           |
| Create or update   | `POST /api/dashboards/db`                | `POST /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards`                                                                                                                                                                                                                                                |
| Delete dashboard   | `DELETE /api/dashboards/uid/{uid}`       | `DELETE /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}`                                                                                                                                                                                                                                        |
| List dashboards    | `GET /api/search`                        | `GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards`                                                                                                                                                                                                                                                 |
| Dashboard versions | `GET /api/dashboards/uid/{uid}/versions` | Version history is now managed through resource metadata, consistent with the Kubernetes resource model. Use label and field selectors on the dashboards resource: `GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards?labelSelector=grafana.app/get-history=true&fieldSelector=metadata.name={uid}` |
| Dashboard tags     | `GET /api/dashboards/tags`               | Deprecated, no replacement planned.                                                                                                                                                                                                                                                                                    |

#### Folders

The folders API is deprecated in Grafana v13.0. The new v1 API is available now.

New API reference: `{your-instance}/swagger?api=folder.grafana.app-v1`

| Operation     | Legacy endpoint                | New endpoint                                                              |
| ------------- | ------------------------------ | ------------------------------------------------------------------------- |
| List folders  | `GET /api/folders`             | `GET /apis/folder.grafana.app/v1/namespaces/{namespace}/folders`          |
| Get folder    | `GET /api/folders/{uid}`       | `GET /apis/folder.grafana.app/v1/namespaces/{namespace}/folders/{uid}`    |
| Create folder | `POST /api/folders`            | `POST /apis/folder.grafana.app/v1/namespaces/{namespace}/folders`         |
| Update folder | `PUT /api/folders/{uid}`       | `PUT /apis/folder.grafana.app/v1/namespaces/{namespace}/folders/{uid}`    |
| Move folder   | `POST /api/folders/{uid}/move` | `PUT /apis/folder.grafana.app/v1/namespaces/{namespace}/folders/{uid}`    |
| Delete folder | `DELETE /api/folders/{uid}`    | `DELETE /apis/folder.grafana.app/v1/namespaces/{namespace}/folders/{uid}` |

To move a folder, set the `grafana.app/folder` annotation to the parent folder UID in the `PUT` request body.

#### Annotations

The annotations API deprecation is in progress. The new annotations API isn't available yet, and the migration path will be announced when it's ready.

- **Resource-based API:** Annotation operations will move to a new endpoint following the pattern `/apis/annotation.grafana.app/{apiVersion}/namespaces/{namespace}/annotations`. The endpoint mapping will be published when the new API is available.
- **Mass delete:** `POST /api/annotations/mass-delete` isn't supported in the new API and has no equivalent UI feature. Use the new TTL (time to live) configuration to define how long annotations are retained instead of performing bulk deletes.
- **Tags:** `GET /api/annotations/tags` is preserved through a dedicated `/tags` route with the same prefix-based filtering.

Audit your current annotation API usage now, particularly any use of mass-delete.

#### Query history

The query history API is deprecated in Grafana v13.0 and will be removed in a future release.

Query history APIs won't be migrated to the Grafana App Platform. Instead, Grafana will revert to using local on-device storage for this functionality.

| Operation            | Legacy endpoint                       | New endpoint                        |
| -------------------- | ------------------------------------- | ----------------------------------- |
| Create query history | `POST /api/query-history`             | Deprecated, no replacement planned. |
| Fetch query history  | `GET /api/query-history?{params}`     | Deprecated, no replacement planned. |
| Delete a query       | `DELETE /api/query-history/{id}`      | Deprecated, no replacement planned. |
| Update a comment     | `PATCH /api/query-history/{id}`       | Deprecated, no replacement planned. |
| Star a query         | `POST /api/query-history/star/{id}`   | Deprecated, no replacement planned. |
| Unstar a query       | `DELETE /api/query-history/star/{id}` | Deprecated, no replacement planned. |

If you consume the query history APIs directly, adopt a local on-device storage approach. A sample implementation will be provided in a future Grafana release that you can use as a reference.

The legacy endpoints continue to work for now. No immediate action is required, but early migration is recommended.

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

### Removal of `grafana-cli` and `grafana-server` commands

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

### Alertmanager status endpoint requires a new permission

#### You are affected if

You use the `GET /api/alertmanager/grafana/api/v2/status` endpoint and rely on the `alert.notifications:read` permission to access it.

#### Description

The `GET /api/alertmanager/grafana/api/v2/status` endpoint previously required the legacy `alert.notifications:read` permission. It now requires a dedicated `alert.notifications.system-status:read` permission. This new permission is included in the `fixed:alerting.notifications:writer` role, which is granted to Admin users by default.

#### Migration

If you have custom roles that need access to this endpoint, add the `alert.notifications.system-status:read` action to those roles. Admin users are unaffected as they receive this permission automatically through the built-in alerting notifications writer role.
