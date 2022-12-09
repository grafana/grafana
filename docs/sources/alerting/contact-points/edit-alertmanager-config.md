---
aliases:
  - ../message-templating/
  - ../unified-alerting/message-templating/
  - /docs/grafana/latest/alerting/contact-points/edit-alertmanager-config/
  - message-templating/
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
title: Edit contact point
weight: 120
---

# Edit Alertmanager global config

To edit global configuration options for an external Alertmanager, like SMTP server, that is used by default for all email contact types:

1. In the Alerting page, click **Contact points** to open the page listing existing contact points.
1. From the **Alertmanager** drop-down, select an external Alertmanager data source.
1. Click the **Edit global config** option.
1. Add global configuration settings.
1. Click **Save global config** to save your changes.

> **Note** This option is available only for external Alertmanagers. You can configure some global options for Grafana contact types, like email settings, via [Grafana configuration]({{< relref "../../setup-grafana/configure-grafana/" >}})
