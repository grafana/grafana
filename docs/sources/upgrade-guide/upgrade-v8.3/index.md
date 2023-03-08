---
description: Guide for upgrading to Grafana v8.3
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v8.3
menutitle: Upgrade to v8.3
weight: 2600
---

# Upgrade to Grafana v8.3

{{< docs/shared "upgrade/upgrade-common-tasks.md" >}}

## Technical notes

This section describes technical changes associated with this release of Grafana.

### Dashboard references

In 8.3, Grafana dashboards now reference data sources using an object with `uid` and `type` properties instead of the data source name property. A schema migration is applied when existing dashboards open. If you provision dashboards to multiple Grafana instances, then we recommend that you also provision data sources. You can specify the `uid` to be the same for data sources across your instances.
If you need to find the `uid` for a data source created in the UI, check the URL of the data source settings page. The URL follows the pattern ` /data source/edit/${uid}`, meaning the last part is the `uid`.
