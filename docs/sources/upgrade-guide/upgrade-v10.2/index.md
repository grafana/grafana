---
description: Guide for upgrading to Grafana v10.2
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v10.2
menuTitle: Upgrade to v10.2
weight: 1500
---

# Upgrade to Grafana v10.2

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Technical notes

The deprecated `/playlists/{uid}/dashboards` API endpoint has been removed. Dashboard information can be retrieved from the `/dashboard/...` APIs. See GitHub PR [#75503](https://github.com/grafana/grafana/pull/75503) for details.

The `PUT /api/folders/:uid` endpoint no more supports modifying the folder's UID; UIDs are expected to be immutable. See GitHub PR [#74684](https://github.com/grafana/grafana/pull/74684) for details.

In the Azure Monitor data source, the Intersection option has been replaced with a Dashboard option to reduce confusion around how time-ranges work. This is a breaking change as we're removing support for Intersection, but it is replaced with an option that is nearly the same. The Intersection option will be migrated to Dashbaord automatically. See GitHub PR [#74675](https://github.com/grafana/grafana/pull/74675) for more details.

This version removes all components for the old panel header design. See more details in GitHub PR [#74196](https://github.com/grafana/grafana/pull/74196).
