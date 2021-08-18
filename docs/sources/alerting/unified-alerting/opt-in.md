+++
title = "Opt-in to Grafana 8 Alerts"
description = "Enable Grafana 8 Alerts"
weight = 128
+++

# Enable Grafana 8 Alerts

Setting the `ngalert` feature toggle enables the new Grafana 8 alerting system.

> **Note:** We recommend that you backup Grafana's database before enabling this feature. If you are using PostgreSQL as the backend data source, then the minimum required version is 9.5.

At startup, when [the feature toggle is enabled]({{< relref "../../administration/configuration.md">}}#feature_toggles), the legacy Grafana dashboard alerting is disabled and existing dashboard alerts are migrated into a format that is compatible with the Grafana 8 alerting system. You can view these migrated rules, alongside any new alerts you create after the migration, from the Alerting page of your Grafana instance.

> **Note:** Since the new system stores the notification log and silences on disk, we require the use of persistent disks for using Grafana 8 alerts. Otherwise, the silences and notification log will get lost on a restart, and you might get unwanted or duplicate notifications.

Read and write access to dashboard alerts in Grafana versions 7 and earlier were governed by the dashboard and folder permissions under which the alerts were stored. In Grafana 8, alerts are stored in folders and inherit the permissions of those folders. During the migration, dashboard alert permissions are matched to the new rules permissions as follows:

- If alert's dashboard has permissions, it will create a folder named like `Migrated {"dashboardUid": "UID", "panelId": 1, "alertId": 1}` to match permissions of the dashboard (including the inherited permissions from the folder).
- If there are no dashboard permissions and the dashboard is under a folder, then the rule is linked to this folder and inherits its permissions.
- If there are no dashboard permissions and the dashboard is under the General folder, then the rule is linked to the `General Alerting` folder and the rule inherits the default permissions.

During beta, Grafana 8 alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch rules from all other supported data sources at this time.

Also notification channels are migrated to an Alertmanager configuration with the appropriate routes and receivers. Default notification channels are added as contact points to the default route. Notification channels not associated with any Dashboard alert go to the `autogen-unlinked-channel-recv` route.

Since `Hipchat` and `Sensu` are discontinued, they are not migrated to the new alerting. If you have dashboard alerts associated with those types of channels and you want to migrate to the new alerting, make sure you assign another supported notification channel, so that you continue to receive notifications for those alerts.
Finally, silences (expiring after one year) are created for all paused dashboard alerts.

## Disabling Grafana 8 Alerting after migration

To disable Grafana 8 Alerting, remove or disable the `ngalert` feature toggle. Dashboard alerts will be re-enabled and any alerts created during or after the migration are deleted.

> **Note:** Any alerting rules created in the Grafana 8 Alerting system will be lost when migrating back to dashboard alerts
