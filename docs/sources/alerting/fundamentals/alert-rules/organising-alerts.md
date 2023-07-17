---
description: Learn how to organize alert rules
keywords:
  - grafana
  - alerting
  - organization
title: Organising alert rules
weight: 105
---

## Namespaces and groups

Alerts can be organized using Folders for Grafana-managed rules and namespaces for Mimir or Loki rules and group names.

### Namespaces

When creating Grafana-managed rules, the folder can be used to perform access control and grant or deny access to all rules within a specific folder.

### Groups

All rules within a group are evaluated at the same **interval**.

Alert rules and recording rules within a group will always be evaluated **sequentially**, meaning no rules will be evaluated at the same time and in order of appearance.

> **Note** If you want rules to be evaluated concurrently and with different intervals, consider storing them in different groups.
