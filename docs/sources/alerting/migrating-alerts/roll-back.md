---
aliases:
  - ../opt-in/
  - ../unified-alerting/roll-back/
description: Roll back to legacy alerting
title: Roll back to legacy alerting
weight: 103
---

# Roll back to legacy alerting

Once the upgrade has taken place, you still have the option to roll back to legacy alerting. If you choose to roll back, Grafana will restore your alerts to the alerts you had at the point in time when the upgrade took place.

All new alerts and changes made exclusively in Grafana Alerting will be deleted.

To roll back to legacy alerting, enter the following in your configuration:

```
force_migration = true

[alerting]
enabled = true

[unified_alerting]
enabled = false
```

> **Note**: We do not recommend this option. If you choose to roll back, Grafana will restore your alerts to the alerts you had at the point in time when the upgrade took place. All new alerts and changes made exclusively in Grafana Alerting will be deleted.
