---
aliases:
  - ../../configure-alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/configure-alertmanager/
  - ../unified-alerting/fundamentals/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/fundamentals/alertmanager/
  - ../manage-notifications/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/alertmanager/
  - ../fundamentals/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alertmanager/
  - ../fundamentals/notifications/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/alertmanager
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-alertmanager/
description: Learn about Alertmanagers and set up Alerting to use an external Alertmanager
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
title: Add an external Alertmanager
weight: 200
---

Grafana sends firing and resolved alerts to Alertmanagers. The Alertmanager receives alerts, handles silencing, inhibition, grouping, and routing by sending notifications out via your channel of choice, for example, email or Slack.

Grafana has its own Alertmanager, referred to as "Grafana" in the user interface, but also supports sending alerts to other Alertmanagers, such as the [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/). You can use both internal and external Alertmanagers.

The Grafana Alertmanager uses notification policies and contact points to configure how and where a notification is sent; how often a notification should be sent; and whether alerts should all be sent in the same notification, sent in grouped notifications based on a set of labels, or as separate notifications.

Alertmanagers are visible from the drop-down menu on the Alerting Contact Points, Notification Policies, and Silences pages.

In Grafana, you can use the Cloud Alertmanager, Grafana Alertmanager, or an external Alertmanager. You can also run multiple Alertmanagers; your decision depends on your set up and where your alerts are being generated.

- **Grafana Alertmanager** is an internal Alertmanager that is pre-configured and available for selection by default if you run Grafana on-premises or open source.

  The Grafana Alertmanager can receive alerts from Grafana, but it cannot receive alerts from outside Grafana, for example, from Mimir or Loki. Note that inhibition rules are not supported.

- **Cloud Alertmanager** runs in Grafana Cloud and it can receive alerts from Grafana, Mimir, and Loki.

- **External Alertmanager** can receive all your Grafana, Loki, Mimir, and Prometheus alerts. External Alertmanagers can be configured and administered from within Grafana itself.

Here are two examples of when you may want to [add your own external Alertmanager](ref:configure-alertmanager) and send your alerts there instead of the Grafana Alertmanager:

1. You may already have Alertmanagers on-premises in your own Cloud infrastructure that you have set up and still want to use, because you have other alert generators, such as Prometheus.

2. You want to use both Prometheus on-premises and hosted Grafana to send alerts to the same Alertmanager that runs in your Cloud infrastructure.

# Add an external Alertmanager

Set up Grafana to use an external Alertmanager as a single Alertmanager to receive all of your alerts. This external Alertmanager can then be configured and administered from within Grafana itself.

{{% admonition type="note" %}}
Grafana Alerting does not support sending alerts to the AWS Managed Service for Prometheus due to the lack of sigv4 support in Prometheus.
{{% /admonition %}}

After you have added the Alertmanager, you can use the Grafana Alerting UI to manage silences, contact points, and notification policies. A drop-down option in these pages allows you to switch between alertmanagers.

External alertmanagers should now be configured as data sources using Grafana Configuration from the main Grafana navigation menu. This enables you to manage the contact points and notification policies of external alertmanagers from within Grafana and also encrypts HTTP basic authentication credentials.

To add an external Alertmanager, complete the following steps.

1. Click **Connections** in the left-side menu.
1. On the Connections page, search for `Alertmanager`.
1. Click the **Create a new data source** button.

   If you don't see this button, you may need to install the plugin, relaunch your Cloud instance, and then repeat steps 1 and 2.

1. Fill out the fields on the page, as required.

   If you are provisioning your data source, set the flag `handleGrafanaManagedAlerts` in the `jsonData` field to `true` to send Grafana-managed alerts to this Alertmanager.

   **Note:** Prometheus, Grafana Mimir, and Cortex implementations of Alertmanager are supported. For Prometheus, contact points and notification policies are read-only in the Grafana Alerting UI.

1. Click **Save & test**.

{{< admonition type="note" >}}
On the Settings page, you can manage your Alertmanager configurations and configure where Grafana-managed alert instances are forwarded.

- Manage which Alertmanagers receive alert instances from Grafana-managed rules without navigating and editing data sources.
- Manage version snapshots for the built-in Alertmanager, which allows administrators to roll back unintentional changes or mistakes in the Alertmanager configuration.
- Compare the historical snapshot with the latest configuration to see which changes were made.
  {{< /admonition >}}
