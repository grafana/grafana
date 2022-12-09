---
aliases:
  - /docs/grafana/latest/alerting/silences/
  - unified-alerting/silences/
description: Silences
keywords:
  - grafana
  - alerting
  - silence
  - mute
title: Silences
weight: 450
---

# About alerting silences

Use silences to stop notifications from one or more alerting rules. Silences do not prevent alert rules from being evaluated. Nor do they not stop alerting instances from being shown in the user interface. Silences only stop notifications from getting created. A silence lasts for only a specified window of time.

You can configure Grafana managed silences as well as silences for an [external Alertmanager data source]({{< relref "../../datasources/alertmanager/" >}}). For more information, see [Alertmanager]({{< relref "../fundamentals/alertmanager/" >}}).

See also:

- [How label matching works]({{< relref "../fundamentals/annotation-label/labels-and-label-matchers/" >}})
- [Create a silence]({{< relref "create-silence/" >}})
- [Create a URL to link to a silence form]({{< relref "linking-to-silence-form/" >}})
- [Edit silences]({{< relref "edit-silence/" >}})
- [Remove silences]({{< relref "remove-silence/" >}})
