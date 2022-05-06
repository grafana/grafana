+++
title = "Silences"
description = "Silences"
keywords = ["grafana", "alerting", "silence", "mute"]
weight = 450
aliases = ["/docs/grafana/latest/alerting/unified-alerting/silences/"]
+++

# About alerting silences

Use silences to stop notifications from one or more alerting rules. Silences do not prevent alert rules from being evaluated. Nor do they not stop alerting instances from being shown in the user interface. Silences only stop notifications from getting created. A silence lasts for only a specified window of time.

Silences do not prevent alert rules from being evaluated. They also do not stop alert instances being shown in the user interface. Silences only prevent notifications from being created.

You can configure Grafana managed silences as well as silences for an [external Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}). For more information, see [Alertmanager]({{< relref "../fundamentals/alertmanager.md" >}}).

> **Note:** Before Grafana v8.2, the configuration of the embedded Alertmanager was shared across organisations. Users of Grafana 8.0 and 8.1 are advised to use the new Grafana 8 Alerts only if they have one organisation. Otherwise, silences for the Grafana managed alerts will be visible by all organizations.
