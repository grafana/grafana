---
aliases:
  - ../disable-alerting/
  - ../unified-alerting/disable-alerting/
description: Disable alerting in Grafana
title: Disable alerting in Grafana
weight: 105
---

# Disable alerting in Grafana

To disable alerting in Grafana entirely (including both legacy and Grafana Alerting), enter the following in your configuration:

```
[alerting]
enabled = false

[unified_alerting]
enabled = false
```

If at any time you want to turn alerting back on, you can opt in.
