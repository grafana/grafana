---
aliases:
  - ../unified-alerting/alerting-rules/edit-cortex-loki-namespace-group/
    - ../unified-alerting/alerting-rules/edit-mimir-loki-namespace-group/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/organising-alerts/
description: Namespaces, folders, and groups
keywords:
  - grafana
  - alerting
  - organization
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Namespaces, folders, and groups
weight: 105
---

## Namespaces, folders, and groups

Alerts can be organized using folders for Grafana-managed rules and namespaces for Mimir or Loki rules and group names.

### Namespaces and folders

When creating Grafana-managed rules, the folder can be used to perform access control and grant or deny access to all rules within a specific folder.

A namespace contains one or more groups. The rules within a group are run sequentially at a regular interval. The default interval is one (1) minute. You can rename Grafana Mimir or Loki rule namespaces and groups, and edit group evaluation intervals.

### Groups

The rules within a group are run sequentially at a regular interval, meaning no rules will be evaluated at the same time and in order of appearance.. The default interval is one (1) minute. You can rename Grafana Mimir or Loki rule namespaces and groups, and edit group evaluation intervals.

> **Note** If you want rules to be evaluated concurrently and with different intervals, consider storing them in different groups.
