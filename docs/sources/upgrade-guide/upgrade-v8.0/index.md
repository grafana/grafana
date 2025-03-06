---
description: Upgrade to Grafana v8.0
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
labels:
  products:
    - enterprise
    - oss
menutitle: Upgrade to v8.0
title: Upgrade to Grafana v8.0
weight: 2900
---

# Upgrade to Grafana v8.0

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Technical notes

This section describes technical changes associated with this release of Grafana.

### Plugins

Grafana now requires all plugins to be signed. If a plugin is not signed Grafana will not load/start it. This is an additional security measure to make sure plugin files and binaries haven't been tampered with. All Grafana Labs authored plugins, including Enterprise plugins, are now signed. It's possible to allow unsigned plugins using a configuration setting, but is something we strongly advise against doing. For more information about this setting, refer to [allow loading unsigned plugins](../../setup-grafana/configure-grafana/#allow_loading_unsigned_plugins).

### Grafana Live

Grafana now maintains persistent WebSocket connections for real-time messaging needs.

When WebSocket connection is established, Grafana checks the request Origin header due to security reasons (for example, to prevent hijacking of WebSocket connection). If you have a properly defined public URL (`root_url` server option) then the origin check should successfully pass for WebSocket requests originating from public URL pages. In case of an unsuccessful origin check, Grafana returns a 403 error. It's also possible to add a list of additional origin patterns for the origin check.

To handle many concurrent WebSocket connections you may need to tune your OS settings or infrastructure. Grafana Live is enabled by default and supports 100 concurrent WebSocket connections max to avoid possible problems with the file descriptor OS limit. As soon as your setup meets the requirements to scale the number of persistent connections this limit can be increased. You also have an option to disable Grafana Live.

Refer to [Grafana Live configuration](../../setup-grafana/set-up-grafana-live/) documentation for more information.

### Postgres, MySQL, Microsoft SQL Server data sources

Grafana v8.0 changes the underlying data structure to [data frames](https://grafana.com/developers/plugin-tools/key-concepts/data-frames) for the Postgres, MySQL, Microsoft SQL Server data sources. As a result, a _Time series_ query result gets returned in a [wide format](https://grafana.com/developers/plugin-tools/key-concepts/data-frames#wide-format). To make the visualizations work as they did before, you might have to do some manual migrations.

For any existing panels/visualizations using a _Time series_ query, where the time column is only needed for filtering the time range, for example, using the bar gauge or pie chart panel, we recommend that you use a _Table query_ instead and exclude the time column as a field in the response.
Refer to this [issue comment](https://github.com/grafana/grafana/issues/35534#issuecomment-861519658) for detailed instructions and workarounds.

#### Prefix added to series names

When you have a query where there's a time value and a numeric value selected together with a string value that's not named _metric_, the graph panel renders series names as `value <hostname>` rather than just `<hostname>` which was the case before Grafana 8.

```sql
SELECT
  $__timeGroup("createdAt",'10m'),
  avg(value) as "value",
  hostname
FROM grafana_metric
WHERE $__timeFilter("createdAt")
GROUP BY time, hostname
ORDER BY time
```

There are two possible workarounds to resolve this problem:

1. In Grafana v8.0.3, use an alias of the string column selected as `metric`. for example, `hostname as metric`.
2. Use the [Standard field definitions' display name](../../panels-visualizations/configure-standard-options/#display-name) to format the alias. For the preceding example query, you would use `${__field.labels.hostname}` option.

For more information, refer to the our relational databases documentation of [Postgres](../../datasources/postgres/#time-series-queries), [MySQL](../../datasources/mysql/#time-series-queries), [Microsoft SQL Server](../../datasources/mssql/query-editor/#time-series-query-examples).
