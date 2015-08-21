----
page_title: Data source Plugin API
page_description: Data Source Plugin Description
page_keywords: grafana, data source, plugin, api, docs
---

# Data source plugin API

All data sources in Grafana are implemented as plugins.

## Breaking change in 2.2

In Grafana 2.2 a breaking change was introduced for how data source query editors
are structured, defined and loaded. This was in order to support mixing multiple data sources
in the same panel.

In Grafana 2.2, the query editor is no longer defined using the partials section in
`plugin.json`, but defined via an angular directive named using convention naming
scheme like `metricQueryEditor<data source type name>`. For example

Graphite defines a directive like this:

```javascript
module.directive('metricQueryEditorGraphite', function() {
  return {controller: 'GraphiteQueryCtrl', templateUrl: 'app/plugins/datasource/graphite/partials/query.editor.html'};
});
```

Even though the data source type name is with lowercase `g`, the directive uses capital `G` in `Graphite` because
that is how angular directives needs to be named in order to match an element with name `<metric-query-editor-graphite />`.
You also specify the query controller here instead of in the query.editor.html partial like before.

### query.editor.html

This partial needs to be updated, remove the `np-repeat` this is done in the outer partial now,m the query.editor.html
should only render a single query. Take a look at the Graphite or InfluxDB partials for `query.editor.html` for reference.
You should also add a `tight-form-item` with `{{target.refId}}`, all queries needs to be assigned a letter (`refId`).
These query reference letters are going to be utilized in a later feature.


