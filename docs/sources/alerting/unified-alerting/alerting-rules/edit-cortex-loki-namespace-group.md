+++
title = "Edit Cortex or Loki rule groups and namespaces"
description = "Edit Cortex or Loki rule groups and namespaces"
keywords = ["grafana", "alerting", "guide", "group", "namespace", "cortex", "loki"]
weight = 400
+++

# Edit Cortex or Loki rule groups and namespaces

Cortex or Loki rule groups and namespaces can be edited via the Grafana alerting UI. Currently renaming namespaces and groups and editing group evaluation interval is supported.

## Rename a namespace

1. In the Grafana menu hover your cursor over the Alerting (bell) icon.
1. Find any group form the namespace you want to edit and click the edit (pen) icon.
1. Enter new name in the  **Namespace** input and click **Save changes**.

A new namespace will be created, all groups will be copied into it from the old namespace and the old namespace will be deleted.

## Rename rule group or change rule group evaluation interval

Rules within a group are run sequentially at a regular interval, by default every 1 minute. This interval can be changed in the UI.

1. In the Grafana menu hover your cursor over the Alerting (bell) icon.
1. Find the group you want to edit and click the edit (pen) icon.
1. Modify **Rule group** and **Rule group evaluation interval** inputs as necessary and click **Save changes**.

If group was renamed, a new group will be created containing all the rules from the old one, and the old group deleted.

![Group list](/static/img/docs/alerting/unified/rule-list-edit-cortex-loki-icon-8-2.png 'Rule group list screenshot')
![Group edit modal](/static/img/docs/alerting/unified/rule-list-cortex-loki-edit-ns-group-8-2.png 'Rule group edit modal screenshot')