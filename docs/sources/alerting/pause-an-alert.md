+++
title = "Pause alerts"
description = "Pause an existing alert rule"
keywords = ["grafana", "alerting", "guide", "rules", "view"]
type = "docs"
[menu.docs]
name = "Pause alerts"
parent = "alerting"
weight = 400
+++

# Pause an alert

Once you’ve acknowledged an alert, consider pausing it. This can be useful to avoid sending subsequent alerts while you work on a fix.

1. In the Grafana side bar, hover your cursor over the Alerting (bell) icon and then click **Alert Rules**. All configured alert rules are listed, along with their current state.
2. Find your alert in the list, and click the **Pause** icon on the right. The **Pause** icon turns into a **Play** icon.
3. Click the **Play** icon to resume evaluation of your alert.