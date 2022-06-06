---
aliases:
  - /docs/grafana/latest/alerting/unified-alerting/silences/
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

Silences do not prevent alert rules from being evaluated. They also do not stop alert instances being shown in the user interface. Silences only prevent notifications from being created.

You can configure Grafana managed silences as well as silences for an [external Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}). For more information, see [Alertmanager]({{< relref "../fundamentals/alertmanager.md" >}}).

See also:

- [About label matching for alert suppression]({{< relref "./label-matching-alert-suppression.md" >}})
- [Create a silence]({{< relref "./create-silence.md" >}})
- [Create a URL to link to a silence form]({{< relref "./linking-to-silence-form.md" >}})
- [Edit silences]({{< relref "./edit-silence.md" >}})
- [Remove silences]({{< relref "./remove-silence.md" >}})
