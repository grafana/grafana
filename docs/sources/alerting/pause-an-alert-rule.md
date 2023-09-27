+++
title = "Pause alert rule"
description = "Pause an existing alert rule"
keywords = ["grafana", "alerting", "guide", "rules", "view"]
type = "docs"
[menu.docs]
identifier = "pause-alerts"
parent = "alerting"
weight = 400
+++

# Pause an alert rule

Pausing the evaluation of an alert rule can sometimes be useful. For example, during a maintenance window, pausing alert rules can avoid triggering a flood of alerts.

1. In the Grafana side bar, hover your cursor over the Alerting (bell) icon and then click **Alert Rules**. All configured alert rules are listed, along with their current state.
1. Find your alert in the list, and click the **Pause** icon on the right. The **Pause** icon turns into a **Play** icon.
1. Click the **Play** icon to resume evaluation of your alert.