---
aliases:
  - ../opt-in/
  - ../unified-alerting/opt-in/
description: Opt in to Grafana Alerting
title: Opt in to Grafana Alerting
weight: 104
---

# Opt in to Grafana Alerting

If you have previously disabled alerting in Grafana, or opted out of Grafana Alerting and have decided that you would now like to use Grafana Alerting, you can choose to opt in at any time.

If you have been using legacy alerting up until now your existing alerts will be migrated to the new alerts type and no alerts or alerting data are lost. Even if you choose to opt in to Grafana Alerting, you can roll back to legacy alerting at any time.

To opt in to Grafana Alerting, enter the following in your configuration:

```
[alerting]
enabled = false

[unified_alerting]
enabled = true
```
