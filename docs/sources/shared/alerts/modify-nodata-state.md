---
labels:
  products:
    - oss
title: 'Modify no data state'
---

- **Set No Data state** (Default)

  If the pending period is `0`, the alert instance transitions immediately to **No Data**. Otherwise, it transitions to the **Pending** state, and then to **No Data** after the pending period has elapsed and the last evaluation returns no data.

  When entering the **No Data** state, the alert rule creates a new `DatasourceNoData` alert instance with labels for the alert rule name, UID, and data source UID.

- **Set Alerting state**

  If the pending period is `0`, the alert instance transitions immediately to **Alerting**. Otherwise, it transitions to the **Pending** state, and then to **Alerting** after the pending period has elapsed and the last evaluation returns no data or a threshold breach.

- **Set Normal state**

  The alert instance transitions immediately to the **Normal** state.

- **Keep last state**

  The alert instance keeps its current state.
