---
aliases:
  - ../migrating-legacy-alerts/
  - ../unified-alerting/opt-in/
  - differences-and-limitations/
description: Migrate legacy dashboard alerts
title: Differences and limitations
weight: 106
---

# Differences and limitations

There are some differences between Grafana Alerting and legacy dashboard alerts, and a number of features that are no
longer supported. We refer to these as [Differences]({{< relref "#differences" >}}) and [Limitations]({{< relref "#limitations" >}}).

## Differences

1. When Grafana Alerting is enabled or upgraded to Grafana 9.0 or later, existing legacy dashboard alerts migrate in a format compatible with the Grafana Alerting. In the Alerting page of your Grafana instance, you can view the migrated alerts alongside any new alerts.
   This topic explains how legacy dashboard alerts are migrated and some limitations of the migration.

2. Read and write access to legacy dashboard alerts and Grafana alerts are governed by the permissions of the folders storing them. During migration, legacy dashboard alert permissions are matched to the new rules permissions as follows:

- If alert's dashboard has permissions, it will create a folder named like `Migrated {"dashboardUid": "UID", "panelId": 1, "alertId": 1}` to match permissions of the dashboard (including the inherited permissions from the folder).
- If there are no dashboard permissions and the dashboard is under a folder, then the rule is linked to this folder and inherits its permissions.
- If there are no dashboard permissions and the dashboard is under the General folder, then the rule is linked to the `General Alerting` folder, and the rule inherits the default permissions.

3. Since there is no `Keep Last State` option for [`No Data`]({{< relref "../alerting-rules/create-grafana-managed-rule/#no-data--error-handling" >}}) in Grafana Alerting, this option becomes `NoData` during the legacy rules migration. Option "Keep Last State" for [`Error handling`]({{< relref "../alerting-rules/create-grafana-managed-rule/#no-data--error-handling" >}}) is migrated to a new option `Error`. To match the behavior of the `Keep Last State`, in both cases, during the migration Grafana automatically creates a silence for each alert rule with a duration of 1 year.

4. Notification channels are migrated to an Alertmanager configuration with the appropriate routes and receivers. Default notification channels are added as contact points to the default route. Notification channels not associated with any Dashboard alert go to the `autogen-unlinked-channel-recv` route.

5. Unlike legacy dashboard alerts where images in notifications are enabled per contact point, images in notifications for Grafana Alerting must be enabled in the Grafana configuration, either in the configuration file or environment variables, and are enabled for either all or no contact points. Refer to [images in notifications](https://grafana.com/docs/grafana/latest/alerting/manage-notifications/images-in-notifications/).
6. Grafana Alerting does not support pausing the evaluation of alert rules. After migration, all paused alert rules will become active, which may cause unexpected notifications to be sent.

## Limitations

1. Since `Hipchat` and `Sensu` notification channels are no longer supported, legacy alerts associated with these channels are not automatically migrated to Grafana Alerting. Assign the legacy alerts to a supported notification channel so that you continue to receive notifications for those alerts.
   Silences (expiring after one year) are created for all paused dashboard alerts.
