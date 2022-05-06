+++
title = "Create a silence"
description = "Add silence alert notification"
keywords = ["grafana", "alerting", "silence", "mute"]
weight = 450
aliases = ["/docs/grafana/latest/alerting/unified-alerting/silences/"]
+++

# Create a silence

To add a silence:

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. In the Alerting page, click **Silences** to open the page listing existing contact points.
1. From Alertmanager drop-down, select an external Alertmanager to create and manage silences for the external data source. Otherwise, keep the default option of Grafana.
1. Click **New Silence** to open the Create silence page.
1. In **Silence start and end**, select the start and end date to indicate when the silence should go into effect and expire.
1. Optionally, in **Duration**, specify how long the silence is enforced. This automatically updates the end time in the **Silence start and end** field.
1. In the **Name** and **Value** fields, enter one or more _Matching Labels_. Matchers determine which rules the silence will apply to. For more information, see [Label matching for alert suppression]({{< relref "./label-matching-alert-suppression.md" >}}).
1. In **Comment**, add details about the silence.
1. In **Creator**, enter the name of the silence owner or keep the default owner.
1. Click **Create**.
