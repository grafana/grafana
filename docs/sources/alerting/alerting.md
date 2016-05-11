---
page_title: Alerting
page_description: Alerting for Grafana
page_keywords: alerting, grafana, plugins, documentation
---

# Alerting

> Alerting is still in very early development. Please be aware.

The roadmap for alerting is described in [issue #2209](https://github.com/grafana/grafana/issues/2209#issuecomment-210077445) and the current state can be found at this page.

## Introduction

So far Grafana does only support saving alering rules but not execute it. This means that you have to export them from grafana using the api and import them into your monitoring tool of choice. The current defintion of an alert rule looks like this:

``` go
type AlertRule struct {
  Id           int64  `json:"id"`
  OrgId        int64  `json:"-"`
  DashboardId  int64  `json:"dashboardId"`
  PanelId      int64  `json:"panelId"`
  Query        string `json:"query"`
  QueryRefId   string `json:"queryRefId"`
  WarnLevel    int64  `json:"warnLevel"`
  CritLevel    int64  `json:"critLevel"`
  WarnOperator string `json:"warnOperator"`
  CritOperator string `json:"critOperator"`
  Interval     string `json:"interval"`
  Title        string `json:"title"`
  Description  string `json:"description"`
  QueryRange   string `json:"queryRange"`
  Aggregator   string `json:"aggregator"`
  State        string `json:"state"`
}
```

Most of these properties might require some extra explaination.

Query: json representation of the query used by grafana. Differes depending on datasource.
QueryRange: The time range for which the query should look back.
Aggregator: How the result should be reduced into a single value. ex avg, sum, min, max
State: Current state of the alert OK, WARN, CRITICAL, ACKNOWLEGED.

You can configure these settings in the Alerting tab on graph panels in edit mode. When the dashboard is saved the alert is created or updated based on the dashboard. If you wish to delete an alert you simply set the query to '- select query -' in the alerting tab and save the dashboard.

## Api

### Alert rules

``` url
GET /api/alerts/rules
```

``` http
state //array of strings *optional*
dashboardId //int *optional*
panelId //int *optional*

Result
[]AlertRule
```

``` http
GET /api/alerts/rules/:alertId

Result AlertRule
```

### Alert state

``` http
GET /api/alerts/rulres/:alertId/states

Result
[
  {
    alertId: int,
    newState: OK, WARN, CRITICAL, ACKNOWLEGED,
    created: timestamp,
    info: description of what might have caused the changed alert state
  }
]
```

``` http
PUT /api/alerts/rulres/:alertId/state
Request
{
  alertId: alertid,
  newState: OK, WARN, CRITICAL, ACKNOWLEGED,
  info: description of what might have caused the changed alert state
}
```

### Alert rule changes
``` http
GET /api/alerts/changes
limit //array of strings *optional*
sinceId //int *optional*

Result
[
  {
    id: incrementing id,
    alertId: alertId,
    type: CREATED/UPDATED/DELETED,
    created: timestamp,
  }
]
```
