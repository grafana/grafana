+++
title = "Edit Cortex or Loki rule groups and namespaces"
description = "Edit Cortex or Loki rule groups and namespaces"
keywords = ["grafana", "alerting", "guide", "group", "namespace", "cortex", "loki"]
weight = 400
+++

# Edit Cortex or Loki rule groups and namespaces

You can rename Cortex or Loki rule namespaces and groups and edit group evaluation intervals.

## Rename a namespace

A namespace contains one or more groups. To rename a namespace, find a group that belongs to the namespace, then update the namespace.

1. Hover your cursor over the Alerting (bell) icon in the side menu.
1. Locate a group that belongs to the namespace you want to edit and click the edit (pen) icon.
1. Enter a new name in the  **Namespace** field, then click **Save changes**.

A new namespace is created and all groups are copied into this namespace from the old one. The old namespace is deleted.

## Rename rule group or change rule group evaluation interval

The rules within a group are run sequentially at a regular interval, the default interval is one (1) minute. You can modify this interval using the following instructions.

1. Hover your cursor over the Alerting (bell) icon in the side menu.
1. Find the group you want to edit and click the edit (pen) icon.
1. Modify the **Rule group** and **Rule group evaluation interval** information as necessary.
1. Click **Save changes**.

If you remaned the group, a new group is created that has all the rules from the old group, and the old group deleted.

![Group list](/static/img/docs/alerting/unified/rule-list-edit-mimir-loki-icon-8-2.png 'Rule group list screenshot')
![Group edit modal](/static/img/docs/alerting/unified/rule-list-mimir-loki-edit-ns-group-8-2.png 'Rule group edit modal screenshot')