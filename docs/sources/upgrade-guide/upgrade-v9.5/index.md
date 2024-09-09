---
description: Upgrade to Grafana v9.5
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
labels:
  products:
    - enterprise
    - oss
menuTitle: Upgrade to v9.5
title: Upgrade to Grafana v9.5
weight: 1800
---

# Upgrade to Grafana v9.5

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Technical notes

### InfluxDB provisioning change

Beginning in v9.5, the InfluxDB data source deprecates the `database` field in provisioning files.
The `dbName` field under `jsonData` must be used to store the database information.
For more information and examples, please refer to [InfluxDB Provisioning]({{< relref "../../datasources/influxdb#provision-the-data-source" >}}).

### Dashboard previews deprecation notice

We are deprecating the dashboard previews feature and will remove it in Grafana v10. We've started exploring alternative ways of adding visual previews using the Scenes framework, and we'll share more information about it in the future.

### Migrate your API keys to service accounts

We are upgrading Grafana [API keys](/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/migrate-api-keys/) to service accounts. Service accounts are a superset of API keys that include token rotation and compatibility with [Role-based access control]({{< relref "../../administration/roles-and-permissions/access-control" >}}). In a future release, we'll automatically migrate all existing API keys to service accounts. All of your existing tokens will continue to work; they will simply be migrated to service accounts. You can preempt this change by migrating your existing API keys to service accounts using Grafana's UI or API. Learn how to do this in the [API keys documentation](/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/migrate-api-keys/).
