---
aliases:
  - difference-old-new/
  - unified-alerting/
  - unified-alerting/difference-old-new/
  - alerting/migrating-alerts/
description: Upgrade Grafana alerts
title: Upgrade Alerting
weight: 150
---

# Upgrade Alerting

Grafana Alerting is enabled by default for new installations or existing installations whether or not legacy alerting is configured.

{{% admonition type="note" %}}
When upgrading, your dashboard alerts are migrated to a new format. This migration can be rolled back easily by opting out. If you have any questions regarding this migration, please contact us.
{{% /admonition %}}

Existing installations that do not use legacy alerting will have Grafana Alerting enabled by default unless alerting is disabled in the configuration.

Likewise, existing installations that use legacy alerting will be automatically upgraded to Grafana Alerting unless you have opted out of Grafana Alerting before migration takes place. During the upgrade, legacy alerts are migrated to the new alerts type and no alerts or alerting data are lost.

Once the upgrade has taken place, you still have the option to roll back to legacy alerting. However, we do not recommend choosing this option. If you do choose to roll back, Grafana will restore your alerts to the alerts you had at the point in time when the upgrade took place. All new alerts and changes made exclusively in Grafana Alerting will be deleted.

{{% admonition type="note" %}}
Cloud customers, who do not want to upgrade to Grafana Alerting, should contact customer support.
{{% /admonition %}}

If you have opted out or rolled back, you can always choose to opt in to Grafana Alerting at a later point in time.

The following table provides details on the upgrade for Cloud, Enterprise, and OSS installations and the new Grafana Alerting UI.

| Grafana instance upgraded to 9.0 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cloud                            | Existing Cloud installations with legacy dashboard alerting will have two alerting icons in the left navigation panel - the old alerting plugin icon and the new Grafana Alerting icon. During upgrade, existing alerts from the Cloud alerting plugin are migrated to Grafana Alerting. Once migration is complete, you can access and manage the older alerts from the new alerting Grafana Alerting icon in the navigation panel. The (older) Cloud alerting plugin is uninstalled from your cloud instance. Contact customer support if you **do not wish** to migrate to Grafana Alerting for your Cloud stack. If you choose to use legacy alerting, use the You will see the new Grafana Alerting icon as well as the old Cloud alerting plugin in the left navigation panel. |
| Enterprise                       | Existing Enterprise instances using legacy alerting will have both the old (marked as legacy) and the new alerting icons in the navigation panel. During upgrade, existing legacy alerts are migrated to Grafana Alerting. If you wish, you can opt out of Grafana Alerting and roll back to legacy alerting. In that case, you can manage your legacy alerts from the alerting icon marked as legacy.                                                                                                                                                                                                                                                                                                                                                                               |
| OSS                              | Existing OSS installations with legacy dashboard alerting will have two alerting icons in the left navigation panel - the old alerting icon (marked as legacy) and the new Grafana Alerting icon. During upgrade, existing legacy alerts are migrated to Grafana Alerting. If you wish, you can opt out of Grafana Alerting and roll back to legacy alerting. In that case, you can manage your legacy alerts from the alerting icon marked as legacy.                                                                                                                                                                                                                                                                                                                               |

> **Note:** Starting with v9.0, legacy alerting is deprecated and will be removed in a future release.

## Opt out

You can opt out of Grafana Alerting at any time and switch to using legacy alerting. Alternatively, you can opt out of using alerting in its entirety.

## Stay on legacy alerting

When upgrading to Grafana > 9.0, existing installations that use legacy alerting are automatically upgraded to Grafana Alerting unless you have opted-out of Grafana Alerting before migration takes place. During the upgrade, legacy alerts are migrated to the new alerts type and no alerts or alerting data are lost. To keep using legacy alerting and deactivate Grafana Alerting:

1. Go to your custom configuration file ($WORKING_DIR/conf/custom.ini).
2. Enter the following in your configuration:

```
[alerting]
enabled = true

[unified_alerting]
enabled = false
```

Installations that have been migrated to Grafana Alerting can roll back to legacy alerting at any time.

{{% admonition type="note" %}}
This topic is only relevant for OSS and Enterprise customers. Contact customer support to enable or disable Grafana Alerting for your Grafana Cloud stack.
{{% /admonition %}}

The `ngalert` toggle previously used to enable or disable Grafana Alerting is no longer available.

## Deactivate alerting

You can deactivate both Grafana Alerting and legacy alerting in Grafana.

1. Go to your custom configuration file ($WORKING_DIR/conf/custom.ini).
1. Enter the following in your configuration:

```
[alerting]
enabled = false

[unified_alerting]
enabled = false
```

3. Restart Grafana for the configuration changes to take effect.

If you want to turn alerting back on, you can remove both flags to enable Grafana Alerting.

## Roll back

Once the upgrade has taken place, you still have the option to roll back to legacy alerting. If you choose to roll back, Grafana will restore your alerts to the alerts you had at the point in time when the upgrade took place.

All new alerts and changes made exclusively in Grafana Alerting will be deleted.

To roll back to legacy alerting, enter the following in your configuration:

```
force_migration = true

[alerting]
enabled = true

[unified_alerting]
enabled = false
```

> **Note**: We do not recommend this option. If you choose to roll back, Grafana will restore your alerts to the alerts you had at the point in time when the upgrade took place. All new alerts and changes made exclusively in Grafana Alerting will be deleted.

## Opt in

If you have previously disabled alerting in Grafana, or opted out of Grafana Alerting and have decided that you would now like to use Grafana Alerting, you can choose to opt in at any time.

If you have been using legacy alerting up until now your existing alerts will be migrated to the new alerts type and no alerts or alerting data are lost. Even if you choose to opt in to Grafana Alerting, you can roll back to legacy alerting at any time.

To opt in to Grafana Alerting, enter the following in your configuration:

```
[alerting]
enabled = false

[unified_alerting]
enabled = true
```

## Differences and limitations

There are some differences between Grafana Alerting and legacy dashboard alerts, and a number of features that are no
longer supported.

**Differences**

1. When Grafana Alerting is enabled or upgraded to Grafana 9.0 or later, existing legacy dashboard alerts migrate in a format compatible with the Grafana Alerting. In the Alerting page of your Grafana instance, you can view the migrated alerts alongside any new alerts.
   This topic explains how legacy dashboard alerts are migrated and some limitations of the migration.

1. Read and write access to legacy dashboard alerts and Grafana alerts are governed by the permissions of the folders storing them. During migration, legacy dashboard alert permissions are matched to the new rules permissions as follows:

   - If there are dashboard permissions, a folder named `Migrated {"dashboardUid": "UID", "panelId": 1, "alertId": 1}` is created to match the permissions of the dashboard (including the inherited permissions from the folder).
   - If there are no dashboard permissions and the dashboard is in a folder, then the rule is linked to this folder and inherits its permissions.
   - If there are no dashboard permissions and the dashboard is in the General folder, then the rule is linked to the `General Alerting` folder and the rule inherits the default permissions.

1. `NoData` and `Error` settings are migrated as is to the corresponding settings in Grafana Alerting, except in two situations:

   3.1. As there is no `Keep Last State` option for `No Data` in Grafana Alerting, this option becomes `NoData`. The `Keep Last State` option for `Error` is migrated to a new option `Error`. To match the behavior of the `Keep Last State`, in both cases, during the migration Grafana automatically creates a silence for each alert rule with a duration of 1 year.

   3.2. Due to lack of validation, legacy alert rules imported via JSON or provisioned along with dashboards can contain arbitrary values for `NoData` and [`Error`](/docs/sources/alerting/alerting-rules/create-grafana-managed-rule.md#configure-no-data-and-error-handling). In this situation, Grafana will use the default setting: `NoData` for No data, and `Error` for Error.

1. Notification channels are migrated to an Alertmanager configuration with the appropriate routes and receivers. Default notification channels are added as contact points to the default route. Notification channels not associated with any Dashboard alert go to the `autogen-unlinked-channel-recv` route.

1. Unlike legacy dashboard alerts where images in notifications are enabled per contact point, images in notifications for Grafana Alerting must be enabled in the Grafana configuration, either in the configuration file or environment variables, and are enabled for either all or no contact points.

1. The JSON format for webhook notifications has changed in Grafana Alerting and uses the format from [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config).

1. Alerting on Prometheus `Both` type queries is not supported in Grafana Alerting. Existing legacy alerts with `Both` type queries are migrated to Grafana Alerting as alerts with `Range` type queries.

**Limitations**

1. Since `Hipchat` and `Sensu` notification channels are no longer supported, legacy alerts associated with these channels are not automatically migrated to Grafana Alerting. Assign the legacy alerts to a supported notification channel so that you continue to receive notifications for those alerts.
   Silences (expiring after one year) are created for all paused dashboard alerts.
