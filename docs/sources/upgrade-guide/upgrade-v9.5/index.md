---
description: Guide for upgrading to Grafana v9.5
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v9.5
menutitle: Upgrade to v9.5
weight: 1800
---

# Upgrade to Grafana v9.5

{{< docs/shared "upgrade/upgrade-common-tasks.md" >}}

## Technical notes

### InfluxDB provisioning change

Beginning in v9.5, the InfluxDB data source deprecates the database field in provisioning files.
The `dbName` field under `jsonData` must be used to store the database information.
For more information and examples, please refer to [InfluxDB Provisioning]({{< relref "../datasources/influxdb/#provision-the-data-source" >}}).

### Dashboard previews deprecation notice

We are deprecating the [Dashboard previews]({{< relref "../search/dashboard-previews" >}}) feature, and will remove it in Grafana v10. We have started exploring alternative ways of adding visual previews using the Scenes framework, and we'll share more information about it in the future.
