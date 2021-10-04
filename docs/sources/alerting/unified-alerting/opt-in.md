+++
title = "Opt-in to Grafana 8 Alerts"
description = "Enable Grafana 8 Alerts"
weight = 128
+++

# Opt-in to Grafana 8 alerts

This topic describes how to enable Grafana 8 alerts as well as the rules and restrictions that govern the migration of existing dashboard alerts to this new alerting system. You can also [disable Grafana 8 alerts]({{< relref "./opt-in.md#disable-grafana-8-alerts" >}}) if needed.

Before you begin, we recommend that you backup Grafana's database. If you are using PostgreSQL as the backend data source, then the minimum required version is 9.5.

## Enable Grafana 8 alerts

To enable Grafana 8 alerts:

1. Go to your custom configuration file located in $WORKING_DIR/conf/custom.ini.
1. In the [unified alerts]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section, set the `enabled` property to `true`.
1. Next, in the [alerting]({{< relref "../../administration/configuration.md#alerting" >}}) section of the configuration file, update the configuration for the legacy dashboard alerts by setting the `enabled` property to `false`.
1. Restart Grafana for the configuration changes to take effect.

> **Note:** Before Grafana v8.2, to enable or disable Grafana 8 alerts, users configured the `ngalert` feature toggle. This toggle option is no longer available.

Moreover, before v8.2, notification logs and silences were stored on a disk. If you did not use persistent disks, any configured silences and logs would get lost on a restart, resulting in unwanted or duplicate notifications.

As of Grafana 8.2, we no longer require the use of a persistent disk. Instead, the notification logs and silences are stored regularly (every 15 minutes), and a clean shutdown to the database. If you used the file-based approach, Grafana will read the existing file and persisting it eventually.

## Migrating legacy alerts to Grafana 8 alerting system

When Grafana 8 alerting is enabled, existing legacy dashboard alerts migrate in a format compatible with the Grafana 8 alerting system. In the Alerting page of your Grafana instance, you can view the migrated alerts alongside new alerts.

Read and write access to legacy dashboard alerts was governed by the dashboard and folder permissions storing them. In Grafana 8, alerts inherit the permissions of the folders they are stored in. During migration, legacy dashboard alert permissions are matched to the new rules permissions as follows:

- If alert's dashboard has permissions, it will create a folder named like `Migrated {"dashboardUid": "UID", "panelId": 1, "alertId": 1}` to match permissions of the dashboard (including the inherited permissions from the folder).
- If there are no dashboard permissions and the dashboard is under a folder, then the rule is linked to this folder and inherits its permissions.
- If there are no dashboard permissions and the dashboard is under the General folder, then the rule is linked to the `General Alerting` folder, and the rule inherits the default permissions.

Notification channels are migrated to an Alertmanager configuration with the appropriate routes and receivers. Default notification channels are added as contact points to the default route. Notification channels not associated with any Dashboard alert go to the `autogen-unlinked-channel-recv` route.

Since `Hipchat` and `Sensu` notification channels are no longer supported, legacy alerts associated with these channels are not automatically migrated to Grafana 8 alerting. Assign the legacy alerts to a supported notification channel so that you continue to receive notifications for those alerts.
Silences (expiring after one year) are created for all paused dashboard alerts.

### Limitation

Grafana 8 alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch rules from all other supported data sources at this time.

## Disable Grafana 8 alerts

To disable Grafana 8 alerts and enable legacy dashboard alerts:

1. Go to your custom configuration file located in $WORKING_DIR/conf/custom.ini.
1. In the [unified alerts]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section, set the `enabled` property to `false`.
1. Next, in the [alerting]({{< relref "../../administration/configuration.md#alerting" >}}) section of the configuration file, update the configuration for the legacy dashboard alerts by setting the `enabled` property to `true`.
1. Restart Grafana for the configuration changes to take effect.

> **Note:** If you choose to migrate from Grafana 8 alerts to legacy dashboard alerts, you will lose any new alerts that you created in the Grafana 8 alerting system.
