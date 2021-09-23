+++
title = "Alert groups"
description = "View grouped alerts"
keywords = ["grafana", "alerting", "alerts", "groups"]
weight = 400
+++

# View alert groups

Alert groups shows grouped alerts from an alertmanager instance. Alertmanager will group alerts based on common label values. This prevents duplicate alerts from being fired by grouping common alerts into a single alert group. By default, the alerts are grouped according to the root policy in [notification policies]({{< relref "./notification-policies.md" >}}). To view a grouping other than the default use the **custom group by** dropdown to select combinations of labels to group alerts by. This is useful for debugging and verifying your notification policies grouping.
