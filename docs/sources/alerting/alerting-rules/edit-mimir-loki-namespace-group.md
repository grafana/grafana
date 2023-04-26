---
aliases:
  - ../unified-alerting/alerting-rules/edit-cortex-loki-namespace-group/
  - ../unified-alerting/alerting-rules/edit-mimir-loki-namespace-group/
description: Edit Grafana Mimir or Loki rule groups and namespaces
keywords:
  - grafana
  - alerting
  - guide
  - group
  - namespace
  - grafana mimir
  - loki
title: Grafana Mimir or Loki rule groups and namespaces
weight: 405
---

# Grafana Mimir or Loki rule groups and namespaces

A namespace contains one or more groups. The rules within a group are run sequentially at a regular interval. The default interval is one (1) minute. You can rename Grafana Mimir or Loki rule namespaces and groups, and edit group evaluation intervals.

{{< figure src="/static/img/docs/alerting/unified/rule-list-edit-mimir-loki-icon-8-2.png" caption="Rule group list" alt="Group list" >}}

<!-- image is the same as above
{{< figure src="/static/img/docs/alerting/unified/rule-list-edit-mimir-loki-icon-8-2.png" max-width="550px" caption="Alert details" >}}
-->

## Rename a namespace

To rename a namespace:

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Alert rules** to view the list of existing alerts.
1. Find a Grafana Mimir or Loki managed rule with the group that belongs to the namespace you want to edit.
1. Click the **Edit** (pen) icon.
1. Enter a new name in the **Namespace** field, then click **Save changes**.

A new namespace is created and all groups are copied into this namespace from the old one. The old namespace is deleted.

## Rename rule group or change the rule group evaluation interval

The rules within a group are run sequentially at a regular interval, the default interval is one (1) minute. You can modify this interval using the following instructions.

1. In the left-side menu, click the **Alerts & IRM** and then **Alerting**.
1. Click **Alert rules** to view the list of existing alerts.
1. Find a Grafana Mimir or Loki managed rule with the group you want to edit.
1. Click **Edit** (pen) icon.
1. Modify the **Rule group** and **Rule group evaluation interval** information as necessary.
1. Click **Save changes**.

When you rename the group, a new group with all the rules from the old group is created. The old group is deleted.

![Group edit modal](/static/img/docs/alerting/unified/rule-list-mimir-loki-edit-ns-group-8-2.png 'Rule group edit modal screenshot')

<!-- new image that displays current 9.4 state of modal below
{{< figure src="/media/docs/grafana/alerting/screenshot-rule-list-mimir-loki-edit-ns-group-9-4.png" max-width="550px" caption="Rule group edit modal" alt="Group edit modal" >}}
-->
