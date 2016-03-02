---
page_title: Plugin datasources
page_description: Datasource plugins for Grafana
page_keywords: grafana, plugins, documentation
---

 > Our goal is not to have a very extensive documentation but rather have actual code that people can look at. An example implementation of a datasource can be found in the grafana repo under /examples/datasource-plugin-genericdatasource

# Datasources

Datasource plugins enables people to develop plugins for any database that commuicates over http. Its up to the plugin to transform the data into time series data so that any grafana panel can then show it.

To interact with the rest of grafana the plugins module file can export 5 different components.

- Datasource (Required)
- QueryCtrl (Required)
- ConfigCtrl (Required)
- QueryOptionsCtrl
- AnnotationsQueryCtrl

## Plugin json
There are two datasource specific settings for the plugin.json
```
"metrics": true,
"annotations": false,
```
These settings idicates what kind of data the plugin can deliver. Atleast one of them have to be true

## Datasource
The javascript object that communicates with the database and transforms data to times series.

The Datasource should contain the following functions.
```
query(options) //used by panels to get data
testDatasource() //used by datasource configuration page to make sure the connection is working
annotationsQuery(options) // used dashboards to get annotations
metricFindQuery(options) // used by query editor to get metric suggestions.
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
