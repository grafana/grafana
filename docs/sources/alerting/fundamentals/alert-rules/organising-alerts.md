---
description: Learn how to organize alert rules
keywords:
  - grafana
  - alerting
  - organization
title: Organising alert rules
weight: 104
---

## Namespaces and groups

Alerts can be organized using folders for Grafana-managed rules. Namespaces can be used for Mimir or Loki rules, as well as group names.

### Namespaces

When creating Grafana-managed rules, the folder can be used to perform access control and grant or deny access to all rules within a specific folder. For example, you can grant read access to a folder of alert rules to a specific team, while denying access to another team.

### Groups

All rules within a group are evaluated at the same **interval**.An interval is the amount of time between evaluations of alert rules within a group.

Alert rules and recording rules within a group will always be evaluated **sequentially**, meaning no rules will be evaluated at the same time and in order of appearance.

> **Note** If you want rules to be evaluated concurrently and with different intervals, consider storing them in different groups. If you have two alert rules that need to be evaluated every 5 minutes, but another rule that needs to be evaluated every 10 minutes, you can store the first two rules in one group with a 5-minute interval, and the third rule in a separate group with a 10-minute interval.
