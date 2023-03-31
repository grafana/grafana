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

Beginning in v9.5, InfluxDB datasource deprecates the database field in provisioning files.
`dbName` field under `jsonData` must be used to store the database information.
For more information and examples please refer to [InfluxDB Provisioning]({{< relref "../datasources/influxdb/#provision-the-data-source" >}})
