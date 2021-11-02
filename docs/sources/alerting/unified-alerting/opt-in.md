+++
title = "Opt-in to Grafana 8 alerting"
description = "Enable Grafana 8 Alerts"
weight = 115
+++

# Opt-in to Grafana 8 alerting

This topic describes how to opt-in to Grafana 8 alerting and the rules and restrictions that govern the migration of existing dashboard alerts to the new alerting system. You can [disable Grafana 8 alerts]({{< relref "./opt-in.md#disable-grafana-8-alerts" >}}) and use the legacy dashboard alerting if needed.

Before you begin, we recommend that you backup Grafana's database. If you are using PostgreSQL as the backend database, then the minimum required version is 9.5.

## Enable Grafana 8 alerting

To enable Grafana 8 alerts:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [unified alerts]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section.
1. Set the `enabled` property to `true`.
1. Next, for [legacy dashboard alerting]({{< relref "../../administration/configuration.md#alerting" >}}), set the `enabled` flag to `true`.
1. Restart Grafana for the configuration changes to take effect.

> **Note:** The `ngalert` toggle previously used to enable or disable Grafana 8 alerting is no longer available.

Before v8.2, notification logs and silences were stored on a disk. If you did not use persistent disks, you would have lost any configured silences and logs on a restart, resulting in unwanted or duplicate notifications. We no longer require the use of a persistent disk. Instead, the notification logs and silences are stored regularly (every 15 minutes). If you used the file-based approach, Grafana reads the existing file and persists it eventually.

## Migrating legacy alerts to Grafana 8 alerting system

When Grafana 8 alerting is enabled, existing legacy dashboard alerts migrate in a format compatible with the Grafana 8 alerting. In the Alerting page of your Grafana instance, you can view the migrated alerts alongside new alerts.

Read and write access to legacy dashboard alerts and Grafana 8 alerts are governed by the permissions of the folders storing them. During migration, legacy dashboard alert permissions are matched to the new rules permissions as follows:

- If alert's dashboard has permissions, it will create a folder named like `Migrated {"dashboardUid": "UID", "panelId": 1, "alertId": 1}` to match permissions of the dashboard (including the inherited permissions from the folder).
- If there are no dashboard permissions and the dashboard is under a folder, then the rule is linked to this folder and inherits its permissions.
- If there are no dashboard permissions and the dashboard is under the General folder, then the rule is linked to the `General Alerting` folder, and the rule inherits the default permissions.

> **Note:** Since there is no `Keep Last State` option for [`No Data` and `Error handling`]({{< relref "./alerting-rules/create-grafana-managed-rule/#no-data--error-handling" >}}) in Grafana 8 alerting, this option becomes `Alerting` during the legacy rules migration.

Notification channels are migrated to an Alertmanager configuration with the appropriate routes and receivers. Default notification channels are added as contact points to the default route. Notification channels not associated with any Dashboard alert go to the `autogen-unlinked-channel-recv` route.

Since `Hipchat` and `Sensu` notification channels are no longer supported, legacy alerts associated with these channels are not automatically migrated to Grafana 8 alerting. Assign the legacy alerts to a supported notification channel so that you continue to receive notifications for those alerts.
Silences (expiring after one year) are created for all paused dashboard alerts.

### Limitation

Grafana 8 alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch alerting rules from all other supported data sources at this time.

## Disable Grafana 8 alerts

To disable Grafana 8 alerts and enable legacy dashboard alerts:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [Grafana 8 alerting]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section.
1. Set the `enabled` property to `false`.
1. For [legacy dashboard alerting]({{< relref "../../administration/configuration.md#alerting" >}}), set the `enabled` flag to `true`.
1. Restart Grafana for the configuration changes to take effect.

> **Note:** If you choose to migrate from Grafana 8 alerting to legacy dashboard alerting, you will lose any new alerts created in the Grafana 8 alerting system.
