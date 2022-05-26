---
description: Edit Cortex or Loki rule groups and namespaces
keywords:
  - grafana
  - alerting
  - guide
  - group
  - namespace
  - cortex
  - loki
title: Cortex or Loki rule groups and namespaces
weight: 405
---

# Cortex or Loki rule groups and namespaces

A namespace contains one or more groups. The rules within a group are run sequentially at a regular interval. The default interval is one (1) minute. You can rename Cortex or Loki rule namespaces and groups, and edit group evaluation intervals.

![Group list](/static/img/docs/alerting/unified/rule-list-edit-mimir-loki-icon-8-2.png 'Rule group list screenshot')

{{< figure src="/static/img/docs/alerting/unified/rule-list-edit-mimir-loki-icon-8-2.png" max-width="550px" caption="Alert details" >}}

## Rename a namespace

To rename a namespace:

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. Find a Cortex or Loki managed rule with the group that belongs to the namespace you want to edit.
1. Click the **Edit** (pen) icon.
1. Enter a new name in the **Namespace** field, then click **Save changes**.

A new namespace is created and all groups are copied into this namespace from the old one. The old namespace is deleted.

## Rename rule group or change the rule group evaluation interval

The rules within a group are run sequentially at a regular interval, the default interval is one (1) minute. You can modify this interval using the following instructions.

1. n the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. Find a Cortex or Loki managed rule with the group you want to edit.
1. Click **Edit** (pen) icon.
1. Modify the **Rule group** and **Rule group evaluation interval** information as necessary.
1. Click **Save changes**.

When you rename the group, a new group with all the rules from the old group is created. The old group is deleted.

![Group edit modal](/static/img/docs/alerting/unified/rule-list-mimir-loki-edit-ns-group-8-2.png 'Rule group edit modal screenshot')
