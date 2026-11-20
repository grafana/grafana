---
aliases:
  - ../../configure-alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/configure-alertmanager/
  - ../unified-alerting/fundamentals/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/fundamentals/alertmanager/
  - ../manage-notifications/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/alertmanager/
  - ../fundamentals/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alertmanager/
  - ../fundamentals/notifications/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/alertmanager
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-alertmanager/
description: Learn about Alertmanagers and set up Alerting to use other Alertmanagers
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - external Alertmanager
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure Alertmanagers
weight: 200
---

# Configure Alertmanagers

Grafana Alerting is based on the architecture of the Prometheus alerting system. Grafana sends firing and resolved alerts to an Alertmanager, which is responsible for [handling notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/). This architecture decouples alert rule evaluation from notification handling, improving scalability.

{{< figure src="/media/docs/alerting/alerting-alertmanager-architecture.png" max-width="750px" alt="A diagram with the alert generator and alert manager architecture" >}}

Grafana includes a built-in **Grafana Alertmanager** to handle notifications. This guide shows you how to:

- Use different [types of Alertmanagers](#types-of-alertmanagers-in-grafana) with Grafana
- [Add other Alertmanager](#add-an-alertmanager) and [enable it to receive all Grafana-managed alerts](#enable-an-alertmanager-to-receive-grafana-managed-alerts)
- Use an [Alertmanager as a contact point](#use-an-alertmanager-as-a-contact-point-to-receive-specific-alerts) to route specific alerts

{{< admonition type="caution" >}}
In Grafana Cloud, data source-managed alerts for the default Loki and Prometheus data sources are deprecated. New Grafana Cloud stacks use Grafana-managed alerts by default, and Grafana Labs doesn't provision the Grafana Cloud Alertmanager for them. Existing stacks aren't affected. If you add your own Alertmanager data source, you can continue to use it.

The standalone Alertmanager UI in Grafana Cloud, for example `https://alertmanager-<REGION>.grafana.net/alertmanager/`, is also deprecated and no longer available.

For more information, refer to [Legacy data source-managed alerts](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/).
{{< /admonition >}}

## Alertmanager resources

It’s important to note that each Alertmanager manages its own independent alerting resources, such as:

- Contact points and notification templates
- Notification policies and mute timings
- Silences
- Active notifications

The [Configure notifications](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/) documentation describes how to manage these resources in the Grafana Alertmanager. To view or manage the resources of another Alertmanager, refer to [Manage notification resources in other Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/manage-alertmanager-resources/).

## Types of Alertmanagers in Grafana

Grafana can be configured to handle alert notifications using various Alertmanagers.

- **Grafana Alertmanager**: Grafana includes a built-in Alertmanager that extends the [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/). This is the default Alertmanager and is referred to as "Grafana" in the user interface. It can only handle Grafana-managed alerts.

- **Other Alertmanagers**: Grafana Alerting also supports sending alerts to other Alertmanagers, such as the [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/).

Grafana Alerting supports using a combination of Alertmanagers and can [enable other Alertmanagers to receive Grafana-managed alerts](#enable-an-alertmanager-to-receive-grafana-managed-alerts). The decision often depends on your alerting setup and where your alerts are generated.

For example, if you already have an Alertmanager running in your on-premises or cloud infrastructure to handle Prometheus alerts, you can forward Grafana-managed alerts to the same Alertmanager for unified notification handling.

## Add an Alertmanager

Alertmanagers should be configured as data sources using Grafana Configuration from the main Grafana navigation menu. To add an Alertmanager, complete the following steps.

{{< docs/shared lookup="alerts/add-alertmanager-ds.md" source="grafana" version="<GRAFANA_VERSION>" >}}

For provisioning instructions, refer to the [Alertmanager data source documentation](/docs/grafana/<GRAFANA_VERSION>/datasources/alertmanager/).

After adding an Alertmanager, you can manage its notification policies, contact points, silences, and other alerting resources from within Grafana. For instructions and limitations, refer to [Manage notification resources in other Alertmanagers](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/manage-alertmanager-resources/).

## Enable an Alertmanager to receive Grafana-managed alerts

After enabling **Receive Grafana Alerts** in the Data Source Settings, you must also configure the Alertmanager in the Alerting Settings page. Grafana supports enabling one or multiple Alertmanagers to receive all generated Grafana-managed alerts.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Settings** to view the list of configured Alertmanagers.
1. For the selected Alertmanager, click the **Enable/Disable** button to toggle receiving Grafana-managed alerts. When activated, the Alertmanager displays `Receiving Grafana-managed alerts`.

{{< figure src="/media/docs/alerting/grafana-alerting-settings.png" max-width="750px" alt="Grafana Alerting Settings page" >}}

All Grafana-managed alerts are forwarded to Alertmanagers marked as `Receiving Grafana-managed alerts`.

{{< admonition type="note" >}}
Grafana Alerting does not support forwarding Grafana-managed alerts to the AlertManager in Amazon Managed Service for Prometheus. For more details, refer to [this GitHub issue](https://github.com/grafana/grafana/issues/64064).
{{< /admonition >}}

## Use an Alertmanager as a contact point to receive specific alerts

The previous instructions enable sending **all** Grafana-managed alerts to an Alertmanager.

To send **specific** alerts to an Alertmanager, configure the Alertmanager as a contact point. You can then assign this contact point to notification policies or individual alert rules.

For detailed instructions, refer to:

- [Alertmanager contact point](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/manage-contact-points/integrations/configure-alertmanager/)
- [Configure Grafana-managed alert rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/#configure-notifications)
- [Configure notification policies](/docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-notification-policy/)

## Manage Alertmanager configurations

On the Settings page, you can also manage your Alertmanager configurations.

- Manage version snapshots for the built-in Alertmanager, which allows administrators to roll back unintentional changes or mistakes in the Alertmanager configuration.
- Compare the historical snapshot with the latest configuration to see which changes were made.

### Configuration history limits

Grafana stores up to the last 100 configuration versions for the built-in Grafana Alertmanager, per organization, including the current one. Each time the Alertmanager configuration changes, Grafana saves a new version and permanently deletes the oldest version once the limit is exceeded.

To avoid losing a working configuration:

- **Back up your configuration**: [Export and store](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/export-alerting-resources/) your Alertmanager configuration outside of Grafana before you automate changes or run large-scale updates.
- **Test changes in a low-impact environment**: Run automations and configuration experiments against a development or staging Grafana instance before applying them to production.
- **Limit the frequency of automated changes**: Frequent automated updates consume the available configuration history. Batch changes where possible so that a single mistake doesn't overwrite every recoverable version.
