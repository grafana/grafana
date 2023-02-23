---
description: Guide for upgrading to Grafana v8.5
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v8.5
menutitle: Upgrade to v8.5
weight: 2400
---

# Upgrade to Grafana v8.5

{{< docs/shared "upgrade/upgrade-common-tasks.md" >}}

## Technical notes

This section describes technical changes associated with this release of Grafana.

### Default data source

The concept of a `default` data source existed in Grafana since the beginning. However, the meaning and behavior were not clear. The default data source was not just the starting data source for new panels but it was also saved using a special value (null). This made it possible to change the default data source to another and have that change impact all dashboards that used the default data source.

This behavior was not very intuitive and creates issues for users who want to change the default without it impacting existing dashboards.
That is why we are changing the behavior in 8.5. From now on, the `default` data source will not be a persisted property but just the starting data source for new panels and queries.
Existing dashboards that still have panels with a `datasource` set to null will be migrated when the dashboard opens. The migration will set the data source property to the **current** default data source.
