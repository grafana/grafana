+++
title = "Migration to Grafana 8 alerting"
description = "Enable Grafana 8 Alerts"
weight = 115
+++

## Migrating legacy alerts to Grafana 8 alerting system

When Grafana 8 alerting is enabled or Grafana is upgraded to version 8.3, existing legacy dashboard alerts migrate in a format compatible with the Grafana 8 alerting. In the Alerting page of your Grafana instance, you can view the migrated alerts alongside new alerts.

Read and write access to legacy dashboard alerts and Grafana 8 alerts are governed by the permissions of the folders storing them. During migration, legacy dashboard alert permissions are matched to the new rules permissions as follows:

- If alert's dashboard has permissions, it will create a folder named like `Migrated {"dashboardUid": "UID", "panelId": 1, "alertId": 1}` to match permissions of the dashboard (including the inherited permissions from the folder).
- If there are no dashboard permissions and the dashboard is under a folder, then the rule is linked to this folder and inherits its permissions.
- If there are no dashboard permissions and the dashboard is under the General folder, then the rule is linked to the `General Alerting` folder, and the rule inherits the default permissions.

> **Note:** Since there is no `Keep Last State` option for [`No Data`]({{< relref "./alerting-rules/create-grafana-managed-rule/#no-data--error-handling" >}}) in Grafana 8 alerting, this option becomes `NoData` during the legacy rules migration. Option "Keep Last State" for [`Error handling`]({{< relref "./alerting-rules/create-grafana-managed-rule/#no-data--error-handling" >}}) is migrated to a new option `Error`. 
> To match the behavior of the `Keep Last State`, in both cases, during the migration Grafana automatically creates a [silence]({{< relref "./silences.md" >}}) for each alert rule with duration of 1 year.     

Notification channels are migrated to an Alertmanager configuration with the appropriate routes and receivers. Default notification channels are added as contact points to the default route. Notification channels not associated with any Dashboard alert go to the `autogen-unlinked-channel-recv` route.

Since `Hipchat` and `Sensu` notification channels are no longer supported, legacy alerts associated with these channels are not automatically migrated to Grafana 8 alerting. Assign the legacy alerts to a supported notification channel so that you continue to receive notifications for those alerts.
Silences (expiring after one year) are created for all paused dashboard alerts.

Before v8.2, notification logs and silences were stored on a disk. If you did not use persistent disks, you would have lost any configured silences and logs on a restart, resulting in unwanted or duplicate notifications. We no longer require the use of a persistent disk. Instead, the notification logs and silences are stored regularly (every 15 minutes). If you used the file-based approach, Grafana reads the existing file and persists it eventually.


## Disable Grafana 8 alerts

To disable Grafana 8 alerts and enable legacy dashboard alerts:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [Grafana 8 alerting]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section.
1. Set the `enabled` property to `false`.
1. For [legacy dashboard alerting]({{< relref "../../administration/configuration.md#alerting" >}}), set the `enabled` flag to `true`.
1. Restart Grafana for the configuration changes to take effect.

> **Note:** If you choose to migrate from Grafana 8 alerting to legacy dashboard alerting, you will lose any new alerts created in the Grafana 8 alerting system.
