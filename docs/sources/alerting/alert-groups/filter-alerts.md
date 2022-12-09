---
aliases:
  - ../unified-alerting/alert-groups/
  - /docs/grafana/latest/alerting/alert-groups/filter-alerts/
description: Alert groups
keywords:
  - grafana
  - alerting
  - alerts
  - groups
title: Filter alerts
weight: 445
---

# Filter alerts by group

You can use the following filters to view alerts that match specific criteria.

## Search by label

To use this filter option:

In **Search**, enter an existing label to view alerts matching the label. For example, `environment=production,region=~US|EU,severity!=warning`.

## Filter alerts by state

In **States**, select from Active, Suppressed, or Unprocessed states to view alerts matching your selected state. All other alerts are hidden.
