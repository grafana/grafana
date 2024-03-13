---
aliases:
  - ../../fundamentals/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alertmanager/
  - ../../unified-alerting/fundamentals/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/fundamentals/alertmanager/
  - ../../manage-notifications/alertmanager/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/alertmanager/
canonical: https://grafana.com/docs/grafana/latest/alerting/notifications/alertmanager/
description: Learn about Alertmanagers and the Alertmanager options for Grafana Alerting
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alertmanager
weight: 111
---

# Alertmanager

Grafana sends firing and resolved alerts to Alertmanagers. The Alertmanager receives alerts, handles silencing, inhibition, grouping, and routing by sending notifications out via your channel of choice, for example, email or Slack.

Grafana has its own Alertmanager, referred to as "Grafana" in the user interface, but also supports sending alerts to other Alertmanagers too, such as the [Prometheus Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/).

The Grafana Alertmanager uses notification policies and contact points to configure how and where a notification is sent; how often a notification should be sent; and whether alerts should all be sent in the same notification, sent in grouped notifications based on a set of labels, or as separate notifications.

Alertmanagers are visible from the drop-down menu on the Alerting Contact Points, Notification Policies, and Silences pages.

In Grafana, you can use the Cloud Alertmanager, Grafana Alertmanager, or an external Alertmanager. You can also run multiple Alertmanagers; your decision depends on your set up and where your alerts are being generated.

- **Grafana Alertmanager** is an internal Alertmanager that is pre-configured and available for selection by default if you run Grafana on-premises or open-source.

  The Grafana Alertmanager can receive alerts from Grafana, but it cannot receive alerts from outside Grafana, for example, from Mimir or Loki. Note that inhibition rules are not supported.

- **Cloud Alertmanager** runs in Grafana Cloud and it can receive alerts from Grafana, Mimir, and Loki.

- **External Alertmanager** can receive all your Grafana, Loki, Mimir, and Prometheus alerts. External Alertmanagers can be configured and administered from within Grafana itself.

Here are two examples of when you may want to [add your own external alertmanager][configure-alertmanager] and send your alerts there instead of the Grafana Alertmanager:

1. You may already have Alertmanagers on-premises in your own Cloud infrastructure that you have set up and still want to use, because you have other alert generators, such as Prometheus.

2. You want to use both Prometheus on-premises and hosted Grafana to send alerts to the same Alertmanager that runs in your Cloud infrastructure.

{{% docs/reference %}}
[configure-alertmanager]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager"
[configure-alertmanager]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager"
{{% /docs/reference %}}
