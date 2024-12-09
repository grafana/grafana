---
labels:
  products:
    - oss
title: 'Table configure no data and error'
---

| Configure    | Set alert state | Description                                                                                                                                                                                                                                                          |
| ------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NoData       | No Data         | The default option for **No Data** events.<br/>Sets alert instance state to `No data`. <br/> The alert rule also creates a new alert instance `DatasourceNoData` with the name and UID of the alert rule, and UID of the datasource that returned no data as labels. |
| Error        | Error           | The default option for **Error** events.<br/>Sets alert instance state to `Error`. <br/> The alert rule also creates a new alert instance `DatasourceError` with the name and UID of the alert rule, and UID of the datasource that returned no data as labels.      |
| NoData/Error | Alerting        | Sets the alert instance state to `Pending` and then transitions to `Alerting` once the pending period ends. If you sent the pending period to 0, the alert instance state is immediately set to `Alerting`.                                                          |
| NoData/Error | Normal          | Sets alert instance state to `Normal`.                                                                                                                                                                                                                               |
| NoData/Error | Keep Last State | Maintains the alert instance in its last state. Useful for mitigating temporary issues.                                                                                                                                                                              |
