+++
aliases = ["/docs/grafana/latest/alerting/opt-in/", "/docs/grafana/latest/alerting/unified-alerting/opt-in/"]
description = "Enable Grafana alerts"
title = "Opt-in to Grafana alerting"
weight = 113
+++

# Opt-in to Grafana alerting in OSS

This topic discusses how to enable Grafana alerting and migrate from legacy dashboard alerting. It also provides guidance on how to roll back to legacy alerting, if you wish to do so.

> **Note:** This topic is only relevant for OSS and Enterprise customers. Contact customer support to enable Grafana alerting for your Cloud stack.

## Before you begin

We recommend that you backup Grafana's database. If you are using PostgreSQL as the backend database, then the minimum required version is 9.5.

## Enable Grafana alerting

To enable Grafana alerts:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [unified alerts]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section.
2. Set the `enabled` property to `true`.
3. Next, for [legacy dashboard alerting]({{< relref "../../administration/configuration.md#alerting" >}}), set the `enabled` flag to `false`.
4. Restart Grafana for the configuration changes to take effect.

> **Note:** The `ngalert` toggle previously used to enable or disable Grafana alerting is no longer available.

Before v8.2, notification logs and silences were stored on a disk. If you did not use persistent disks, you would have lost any configured silences and logs on a restart, resulting in unwanted or duplicate notifications. We no longer require the use of a persistent disk. Instead, the notification logs and silences are stored regularly (every 15 minutes). If you used the file-based approach, Grafana reads the existing file and persists it eventually.

## Disable Grafana alerts

To disable Grafana alerts and roll back to legacy dashboard alerting:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [Grafana alerting]({{< relref "../../administration/configuration.md#unified_alerting" >}}) section.
1. Set the `enabled` property to `false`.
1. For [legacy dashboard alerting]({{< relref "../../administration/configuration.md#alerting" >}}), set the `enabled` flag to `true`.
1. Restart Grafana for the configuration changes to take effect.

> **Note:** Switching from Grafana to legacy alerting can result in data loss. This is applicable to the fresh installation as well as upgraded setups.
