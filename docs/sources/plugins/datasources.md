---
page_title: Plugin datasources
page_description: Datasource plugins for Grafana
page_keywords: grafana, plugins, documentation
---


# Datasources

Datasource plugins enables people to develop plugins for any database that
communicates over http. Its up to the plugin to transform the data into
time series data so that any grafana panel can then show it.

## Datasource development

> Our goal is not to have a very extensive documentation but rather have actual
> code that people can look at. An example implementation of a datasource can be
> found in this [example datasource repo](https://github.com/grafana/simple-json-datasource)

To interact with the rest of grafana the plugins module file can export 5 different components.

- Datasource (Required)
- QueryCtrl (Required)
- ConfigCtrl (Required)
- QueryOptionsCtrl
- AnnotationsQueryCtrl

## Plugin json

There are two datasource specific settings for the plugin.json

```javascript
"metrics": true,
"annotations": false,
```

These settings indicates what kind of data the plugin can deliver. At least one of them have to be true

## Datasource
The javascript object that communicates with the database and transforms data to times series.

The Datasource should contain the following functions.
```
query(options) //used by panels to get data
testDatasource() //used by datasource configuration page to make sure the connection is working
annotationsQuery(options) // used dashboards to get annotations
metricFindQuery(options) // used by query editor to get metric suggestions.
```

### Query

Request object passed to datasource.query function
```json
{
  "range": { "from": "2015-12-22T03:06:13.851Z", "to": "2015-12-22T06:48:24.137Z" },
  "interval": "5s",
  "targets": [
    { "refId": "B", "target": "upper_75" },
    { "refId": "A", "target": "upper_90" }
  ],
  "format": "json",
  "maxDataPoints": 2495 //decided by the panel
}
```

There are two different kind of results for datasources.
Time series and table. Time series is the most common format and is supported by all datasources and panels. Table format is only support by the Influxdb datasource and table panel. But we might see more of this in the future.

Time series response from datasource.query
An array of
```json
[
  {
    "target":"upper_75",
    "datapoints":[
      [622,1450754160000],
      [365,1450754220000]
    ]
  },
  {
    "target":"upper_90",
    "datapoints":[
      [861,1450754160000],
      [767,1450754220000]
    ]
  }
]
```

Table response from datasource.query
An array of
```json
[
  {
    "columns": [
      {
        "text": "Time",
        "type": "time",
        "sort": true,
        "desc": true,
      },
      {
        "text": "mean",
      },
      {
        "text": "sum",
      }
    ],
    "rows": [
      [
        1457425380000,
        null,
        null
      ],
      [
        1457425370000,
        1002.76215352,
        1002.76215352
      ],
    ],
    "type": "table"
  }
]
```

### Annotation Query

Request object passed to datasource.annotationsQuery function
```json
{
  "range": { "from": "2016-03-04T04:07:55.144Z", "to": "2016-03-04T07:07:55.144Z" },
  "rangeRaw": { "from": "now-3h", to: "now" },
  "annotation": {
    "datasource": "generic datasource",
    "enable": true,
    "name": "annotation name"
  }
}
```

Expected result from datasource.annotationQuery
```json
[
  {
    "annotation": {
      "name": "annotation name", //should match the annotation name in grafana
      "enabled": true,
      "datasource": "generic datasource",
     },
    "title": "Cluster outage",
    "time": 1457075272576,
    "text": "Joe causes brain split",
    "tags": "joe, cluster, failure"
  }
]
```


## QueryCtrl

A javascript class that will be instantiated and treated as an Angular controller when the user edits metrics in a panel. This class have to inherit from the app/plugins/sdk.QueryCtrl class.

Requires a static template or templateUrl variable which will be rendered as the view for this controller.

## ConfigCtrl

A javascript class that will be instantiated and treated as an Angular controller when a user tries to edit or create a new datasource of this type.

Requires a static template or templateUrl variable which will be rendered as the view for this controller.

## QueryOptionsCtrl

A javascript class that will be instantiated and treated as an Angular controller when the user edits metrics in a panel. This controller is responsible for handling panel wide settings for the datasource. Such as interval, rate and aggregations if needed.

Requires a static template or templateUrl variable which will be rendered as the view for this controller.

## AnnotationsQueryCtrl

A javascript class that will be instantiated and treated as an Angular controller when the user choose this type of datasource in the templating menu in the dashboard.

Requires a static template or templateUrl variable which will be rendered as the view for this controller. The fields that are bound to this controller is then sent to the Database objects annotationsQuery function.
