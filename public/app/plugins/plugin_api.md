# Plugin API

### 3.0 changes to plugin api changes

There has been big changes to both data source and plugin schema (plugin.json) and how
you write the plugin main module.

#### Datasource plugin

Now data source plugins AMD/SystemJS module should return:

```javascript
return {
  Datasource: ElasticDatasource,
  configView: editView.default,
  annotationsQueryEditor: annotationsQueryEditor,
  metricsQueryEditor: metricsQueryEditor,
  metricsQueryOptions: metricsQueryOptions,
};
```

Where ElasticDatasource is a constructor function to a javascript. The constructor
function can take angular services and `instanceSettings` as parameters.

Example:

```javascript
function ElasticDatasource(instanceSettings, templateSrv) {
  this.instanceSettings = this.instanceSettings;
  ///...
};
```

A datasource module can optionally return a configView directive function, metricsQueryEditor directive function, etc.

Example:

```javascript
function metricsQueryEditor() {
  return {controller: 'ElasticQueryCtrl', templateUrl: 'public/app/plugins/datasource/elasticsearch/partials/query.editor.html'};
}
```

#### Panel plugin

The panel plugin AMD/SystemJS module should return an object with a property named `panel`. This needs to be
a directive function.

### 2.5.1 changes
datasource annotationQuery changed. now single options parameter with:
- range
- rangeRaw
- annotation

2.5 changed the `range` parameter in the `datasource.query` function's options parameter. This
parameter now holds a parsed range with `moment` dates `form` and `to`. To get
millisecond epoch from a `moment` you the function `valueOf`. The raw date range as represented
internally in grafana (which may be relative expressions like `now-5h`) is included in the
new property `rangeRaw` (on the options object).
