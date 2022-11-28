---
aliases:
  - /docs/grafana/latest/alerting/silences/create-silence/
  - /docs/grafana/latest/alerting/unified-alerting/silences/
description: Add silence alert notification
keywords:
  - grafana
  - alerting
  - silence
  - mute
title: Create a silence
weight: 450
---

# Create a silence

Silences stop notifications from getting created and last for only a specified window of time.

To add a silence:

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
2. On the Alerting page, click **Silences** to open the page listing existing silences.
3. From Alertmanager drop-down, select an external Alertmanager to create and manage silences for the external data source. Otherwise, keep the default option of Grafana.
4. Click **New Silence** to open the Create silence page.
5. In **Silence start and end**, select the start and end date to indicate when the silence should go into effect and expire.
6. Optionally, in **Duration**, specify how long the silence is enforced. This automatically updates the end time in the **Silence start and end** field.
7. In the **Name** and **Value** fields, enter one or more _Matching Labels_. Matchers determine which rules the silence will apply to. For more information, see [how label matching works]({{< relref "../fundamentals/annotation-label/labels-and-label-matchers/" >}}).
8. In **Comment**, add details about the silence.
9. In **Creator**, enter the name of the silence owner or keep the default owner.
10. Click **Create**.
