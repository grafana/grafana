---
description: Enable Grafana alerts
title: Opt-in to Grafana alerting
weight: 115
---

# Opt-in to Grafana alerting

Grafana alerting is enabled by default for new Cloud and OSS installations.

**Note:** If you are an existing Grafana Cloud user and want to explore unified alerting, contact Grafana Support. They will enable unified alerting for your Cloud stack.

For older OSS installations that use legacy dashboard alerts, unified alerting is still an opt-in feature. This topic describes how to opt-in to Grafana alerting if you have an existing Grafana installation and the rules and restrictions that govern the migration of existing dashboard alerts to the new alerting system. You can [disable Grafana alerts]({{< relref "./opt-in.md#disable-grafana-alerts" >}}) and use the legacy dashboard alerting if needed.

Before you begin, we recommend that you backup Grafana's database. If you are using PostgreSQL as the backend database, then the minimum required version is 9.5.

## Enable Grafana alerting

To enable Grafana alerts:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [unified alerts]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section.
1. Set the `enabled` property to `true`.
1. Next, for [legacy dashboard alerting]({{< relref "../../administration/configuration.md#alerting" >}}), set the `enabled` flag to `false`.
1. Restart Grafana for the configuration changes to take effect.

> **Note:** The `ngalert` toggle previously used to enable or disable Grafana alerting is no longer available.

Before v8.2, notification logs and silences were stored on a disk. If you did not use persistent disks, you would have lost any configured silences and logs on a restart, resulting in unwanted or duplicate notifications. We no longer require the use of a persistent disk. Instead, the notification logs and silences are stored regularly (every 15 minutes). If you used the file-based approach, Grafana reads the existing file and persists it eventually.

## Migrating legacy alerts to Grafana alerting system

When Grafana alerting is enabled or Grafana is upgraded to version 8.3, existing legacy dashboard alerts migrate in a format compatible with the Grafana alerting. In the Alerting page of your Grafana instance, you can view the migrated alerts alongside new alerts.

Read and write access to legacy dashboard alerts and Grafana alerts are governed by the permissions of the folders storing them. During migration, legacy dashboard alert permissions are matched to the new rules permissions as follows:

- If alert's dashboard has permissions, it will create a folder named like `Migrated {"dashboardUid": "UID", "panelId": 1, "alertId": 1}` to match permissions of the dashboard (including the inherited permissions from the folder).
- If there are no dashboard permissions and the dashboard is under a folder, then the rule is linked to this folder and inherits its permissions.
- If there are no dashboard permissions and the dashboard is under the General folder, then the rule is linked to the `General Alerting` folder, and the rule inherits the default permissions.

> **Note:** Since there is no `Keep Last State` option for [`No Data`]({{< relref "./alerting-rules/create-grafana-managed-rule/#no-data--error-handling" >}}) in Grafana alerting, this option becomes `NoData` during the legacy rules migration. Option "Keep Last State" for [`Error handling`]({{< relref "./alerting-rules/create-grafana-managed-rule/#no-data--error-handling" >}}) is migrated to a new option `Error`. To match the behavior of the `Keep Last State`, in both cases, during the migration Grafana automatically creates a [silence]({{< relref "./silences.md" >}}) for each alert rule with a duration of 1 year.

Notification channels are migrated to an Alertmanager configuration with the appropriate routes and receivers. Default notification channels are added as contact points to the default route. Notification channels not associated with any Dashboard alert go to the `autogen-unlinked-channel-recv` route.

Since `Hipchat` and `Sensu` notification channels are no longer supported, legacy alerts associated with these channels are not automatically migrated to Grafana alerting. Assign the legacy alerts to a supported notification channel so that you continue to receive notifications for those alerts.
Silences (expiring after one year) are created for all paused dashboard alerts.

### Limitation

Grafana alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch alerting rules from all other supported data sources at this time.

## Disable Grafana alerts

To disable Grafana alerts and enable legacy dashboard alerts:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [Grafana alerting]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section.
1. Set the `enabled` property to `false`.
1. For [legacy dashboard alerting]({{< relref "../../administration/configuration.md#alerting" >}}), set the `enabled` flag to `true`.
1. Restart Grafana for the configuration changes to take effect.

> **Note:** Switching from one flavor of alerting to another can result in data loss. This is applicable to the fresh installation as well as upgraded setups.
