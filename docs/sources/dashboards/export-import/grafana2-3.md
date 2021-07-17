+++
title = "Import and share with Grafana 2.x or 3.0"
keywords = ["grafana", "dashboard", "documentation", "export", "import"]
aliases = ["/docs/grafana/latest/reference/export_import/"]
weight = 800
+++

# Import and share with Grafana 2.x or 3.0

Dashboards on Grafana.com use a new feature in Grafana 3.1 that allows the import process
to update each panel so that they are using a data source of your choice. If you are running a
Grafana version older than 3.1 then you might need to do some manual steps either
before or after import in order for the dashboard to work properly.

Dashboards exported from Grafana 3.1+ have a new json section `__inputs`
that define what data sources and metric prefixes the dashboard uses.

Example:
```json
{
  "__inputs": [
    {
      "name": "DS_GRAPHITE",
      "label": "graphite",
      "description": "",
      "type": "datasource",
      "pluginId": "graphite",
      "pluginName": "Graphite"
    },
    {
      "name": "VAR_PREFIX",
      "type": "constant",
      "label": "prefix",
      "value": "collectd",
      "description": ""
    }
  ]
}

```

These are then referenced in the dashboard panels like this:

```json
{
  "rows": [
      {
        "panels": [
          {
            "type": "graph",
            "datasource": "${DS_GRAPHITE}"
          }
        ]
      }
  ]
}
```

These inputs and their usage in data source properties are automatically added during export in Grafana 3.1.
If you run an older version of Grafana and want to share a dashboard on Grafana.com you need to manually
add the inputs and templatize the data source properties like above.

If you want to import a dashboard from Grafana.com into an older version of Grafana then you can either import
it as usual and then update the data source option in the metrics tab so that the panel is using the correct
data source. Another alternative is to open the json file in a text editor and update the data source properties
to value that matches a name of your data source.