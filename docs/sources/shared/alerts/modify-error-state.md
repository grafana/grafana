---
labels:
  products:
    - oss
title: 'Modify error state'
---

- **Set Error state** (Default)

  If the pending period is `0`, the alert instance transitions immediately to **Error**. Otherwise, it transitions to the **Pending** state, and then to **Error** after the pending period has elapsed and the last evaluation returns an error.

  When entering the **Error** state, the alert rule creates a new `DatasourceError` alert instance with labels for the alert rule name, UID, and data source UID.

- **Set Alerting state**

  If the pending period is `0`, the alert instance transitions immediately to **Alerting**. Otherwise, it transitions to the **Pending** state, and then to **Alerting** after the pending period has elapsed and the last evaluation returns an error or a threshold breach.

- **Set Normal state**

  The alert instance transitions immediately to the **Normal** state.

- **Keep last state**

  The alert instance keeps its current state.
