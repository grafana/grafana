---
aliases:
  - ../../features/dashboard/dashboards/
title: Dashboard rows
weight: 80
---

# Dashboard rows

A dashboard row is a logical divider within a dashboard. It is used to group panels together.

Grafana uses a base unit abstraction so that dashboards and panels look great on all screen sizes. Dashboard rows are always 12 “units” wide. These units are automatically scaled dependent on the horizontal resolution of your browser. You can control the relative width of panels within a row by setting their specific width.

> **Note:** With MaxDataPoint functionality, Grafana can show you the perfect number of data points, regardless of resolution or time range.

## Create or remove rows

Use the [repeating rows]({{< relref "../../variables/_index.md#repeating-rows" >}}) functionality to dynamically create or remove entire rows, which can be filled with panels, based on the template variables selected.

## Collapse rows

Collapse a row by clicking on the row title. If you save a dashboard with a row collapsed, then it saves in that state and does not load those graphs until you expand the row.
