---
description: Guide for upgrading to Grafana v9.0
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v9.0
menutitle: Upgrade to v9.0
weight: 2300
---

# Upgrade to Grafana v9.0

{{< docs/shared "upgrade/upgrade-common-tasks.md" >}}

## Technical notes

This section describes technical changes associated with this release of Grafana.

### Role-based access control: changes for general release

Fine-grained access control is now called "Role-based access control (RBAC)". As part of the Grafana 9.0 release, the feature is generally available, and there are several breaking changes:

- Built-in roles are now called basic roles. They now consist of permissions, not roles.
- The Terraform `builtin_role_assignment` resource is deprecated. Please use [grafana_role](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/role) resource instead.
- Grafana provisioning has a new schema. Please refer to [Provisioning RBAC with Grafana](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-grafana-provisioning/) to learn more about provisioning.
- Basic roles no longer support permission inheritance. Previously, when permissions of a Viewer basic role were modified, it was propagated to the Editor and Admin basic roles. With the Grafana 9.0 release, this is not the case anymore.
- Several role-based access control actions have been renamed. All database entries that use legacy action names will be migrated to use the new names, but provisioning files and scripts will have to be updated by the user. This change also means that if Grafana is downgraded from 9.0 to a lower version, some role-based access control permissions will not be resolved correctly.

### Loki: logs data format changed

In the Loki data source, the data format used to represent Loki logs-data has been changed to a more efficient format. (NOTE: this change applies to logs data only, it does not apply to numeric data)
The logs are represented by a single dataframe with a "labels" field added, instead of separate dataframes for every label combination. Displaying logs data in explore, or in a dashboard using the logs panel will continue to work without changes. But, when displaying logs data in other dashboard panels, for example in a table visualization, changes will be visible, and configurations might need to be adjusted. For example, if the "Labels to fields" transformation was used, it has to be replaced with an “Extract fields” transformation, where the “labels” field is chosen as the source.

### Loki: NaN values representation changed in numeric data

In the Loki data source, when grafana receives numeric data from Loki, it may contain NaN (not a number) values. For consistency and performance reasons we changed how we represent such values in Grafana. In previous versions, the behavior was different between alerting queries and other queries (like dashboard queries or explore queries). Alerting queries kept NaN values unchanged, but other queries converted these values to “null”. Starting with grafana 9.0.0, we will always keep these values unchanged. In other words, queries in dashboards and explore will behave the same as alerting queries in this regard.

### Elasticsearch: Support for versions after their end of life was removed

Support for Elasticsearch versions that are after their end of life (based on https://www.elastic.co/support/eol) was removed. This means that versions older than Elasticsearch 7.10.0 will not be supported in Grafana 9.0.0.

### Elasticsearch: Support for browser access mode removed

In the Elasticsearch data source, browser access mode was deprecated in grafana 7.4.0 and removed in 9.0.0. If you used this mode, please switch to server access mode on the data source configuration page.

### Prometheus: NaN values representation changed in numeric data

In the Prometheus data source, when grafana receives numeric data from Prometheus, it may contain NaN (not a number) values. For consistency and performance reasons we changed how we represent such values in Grafana. In previous versions, the behavior was different between alerting queries and other queries (like dashboard queries or explore queries). Alerting queries kept NaN values unchanged, but other queries converted these values to “null”. Starting with grafana 9.0.0, we will always keep NaN values unchanged for all queries.

<!-- ### InfluxDB: Support for browser access mode removed (should this stay??)

In the InfluxDB data source, browser access mode was deprecated in grafana 8.0.0 and we are removing this feature in 9.0.0. If you are using this mode, you need to [switch to server access mode]({{< relref "../../datasources/influxdb/##influxql-classic-influxdb-query" >}}) on the data source configuration page or you can do this via provisioning. -->

### Transformations: Allow more complex regex expressions in rename by regex

The rename by regex transformation has been improved to allow global patterns of the form `/<stringToReplace>/g`. Depending on the regex match used, this may cause some transformations to behave slightly differently. You can guarantee the same behavior as before by wrapping the match string in forward slashes (`/`), for example, `(.*)` would become `/(.*)/`. ([Github Issue #48179](https://github.com/grafana/grafana/pull/48179))

### Clock Panel

We have updated [clock panel](https://grafana.com/grafana/plugins/grafana-clock-panel/) to version `2.0.0` to make it compatible with Grafana 9. The previous version `1.3.1` will cause the Grafana 9 to [crash](https://github.com/grafana/clock-panel/issues/106) when being used in a dashboard, we encourage you to update the panel before migrating to Grafana 9.

### Polystat Panel

We have updated [polystat panel](https://grafana.com/grafana/plugins/grafana-polystat-panel/) to version `1.2.10` to make it compatible with Grafana 9. The previous versions `1.2.8` and below will render empty in Grafana 9. We encourage you to update the panel before or immediately after migrating to Grafana 9.

### Envelope encryption enabled by default

Since v8.3 a new kind of encryption called "envelope encryption" was added, for those secrets stored in the Grafana
database (data source credentials, alerting notification channel credentials, oauth tokens, etc), behind a feature
toggle named `envelopeEncryption`.

In v9.0, `envelopeEncryption` feature toggle has been replaced in favor of `disableEnvelopeEncryption` and envelope encryption is
the encryption mechanism used by default.

Therefore, any secret created or updated in Grafana v9.0 won't be decryptable by any previous Grafana version unless the
feature toggle `envelopeEncryption` is enabled in the previous version (only available since v8.3).
This needs to be considered in high availability setups, progressive rollouts or in case of need to roll back to a previous Grafana version for any reason.

The recommendation here is to enable `envelopeEncryption` for older versions, or alternatively enable `disableEnvelopeEncryption`
before upgrading to v9.0. However, the latter is probably going to be removed in one of the next releases, so we hugely
encourage to move on with envelope encryption.

Find [here]({{< relref "../../setup-grafana/configure-security/configure-database-encryption/" >}}) more details and some
possible workarounds in case you end up in an undesired situation.

### A note on Grafana Enterprise licensing

When we release Grafana 9.0 on June 14th, Grafana will no longer enforce viewers and editor-admins differently. That means that regardless of whether your Grafana Enterprise license is tiered or combined, instead of seeing this on the Stats & Licensing page:

{{< figure src="/static/img/docs/enterprise/separate-licenses.png" max-width="500px" caption="Separate license" >}}

You will see this:

{{< figure src="/static/img/docs/enterprise/combined-licenses.png" max-width="500px" caption="Combined license" >}}

It also means that Grafana will count all users the same, regardless of their role, including org roles (Viewer, Editor, Admin) and fine-grained roles (Dashboard Editor, Reports Editor, etc.). You won’t see a separate warning banner or see users locked out if you hit your limit of viewers or editor-admins, only your total combined limit of active users.

For example, if you have a license for 10 active admins and 100 active viewers in your Grafana Enterprise license, then starting in v9.0 you will have a limit of 110 active users, and it doesn’t matter what roles those users have, they will all be counted and enforced the same.

This is a more permissive policy than before.
