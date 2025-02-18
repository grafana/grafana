---
labels:
  products:
    - oss
title: 'Table configure no data and error'
---

| Configure        | Set alert state | Description                                                                                                                                                                                                                                                          |
| ---------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No Data          | No Data         | The default option for **No Data** events.<br/>Sets alert instance state to `No Data`. <br/> The alert rule also creates a new alert instance `DatasourceNoData` with the name and UID of the alert rule, and UID of the datasource that returned no data as labels. |
| Error            | Error           | The default option for **Error** events.<br/>Sets alert instance state to `Error`. <br/> The alert rule also creates a new alert instance `DatasourceError` with the name and UID of the alert rule, and UID of the datasource that returned no data as labels.      |
| No Data or Error | Alerting        | Sets the alert instance state to `Pending` and then transitions to `Alerting` once the pending period ends. If you sent the pending period to 0, the alert instance state is immediately set to `Alerting`.                                                          |
| No Data or Error | Normal          | Sets alert instance state to `Normal`.                                                                                                                                                                                                                               |
| No Data or Error | Keep Last State | Maintains the alert instance in its last state. Useful for mitigating temporary issues.                                                                                                                                                                              |
