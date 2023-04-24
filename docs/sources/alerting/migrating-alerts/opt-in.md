---
aliases:
  - ../opt-in/
  - ../unified-alerting/opt-in/
description: Opt in to Grafana Alerting
title: Opt in to Grafana Alerting
weight: 104
---

# Opt in to Grafana Alerting

If you previously disabled alerting or opted out of Grafana Alerting, but now want to use it, you can opt in at any time.

If you have been using legacy alerting up until now your existing alerts will be migrated to the new alerts type and no alerts or alerting data are lost. Even if you opt in to Grafana Alerting, you can switch back to legacy alerting at any time.

To opt in to Grafana Alerting, enter the following in your configuration:

```
[alerting]
enabled = false

[unified_alerting]
enabled = true
```
