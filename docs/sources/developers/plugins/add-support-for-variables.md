+++
title = "Add support for variables in plugins"
type = "docs"
+++

# Add support for variables in plugins

Variables are placeholders for values, and can be used to create things like templated queries and dashboard or panel links. For more information on variables, refer to [Templates and variables]({{< relref "../../variables/templates-and-variables.md" >}}).

This guide explains how to leverage template variables in your panel plugins and data source plugins.

We'll see how you can turn a string like this:

```sql
SELECT * FROM services WHERE id = "$service"
```

into

```sql
SELECT * FROM services WHERE id = "auth-api"
```

Grafana provides a couple of helper functions to interpolate variables in a string template. Let's see how you can use them in your plugin.

## Interpolate variables in panel plugins

For panels, the [replaceVariables]({{< relref "../../packages_api/data/panelprops.md#replacevariables-property" >}}) function is available in the [PanelProps]({{< relref "../../packages_api/data/panelprops.md" >}}).

Add `replaceVariables` to the argument list, and pass it a user-defined template string.

```ts
export const SimplePanel: React.FC<Props> = ({ options, data, width, height, replaceVariables }) => {
  const query = replaceVariables('Now displaying $service')

  return <div>{ query }</div>
}
```

## Interpolate variables in data source plugins

For data sources, you need to use the [getTemplateSrv]({{< relref "../../packages_api/runtime/gettemplatesrv.md" >}}), which returns an instance of [TemplateSrv]({{< relref "../../packages_api/runtime/templatesrv.md" >}}).

1. Import `getTemplateSrv` from the `runtime` package.

   ```ts
   import { getTemplateSrv } from '@grafana/runtime';
   ```

1. In your `query` method, call the `replace` method with a user-defined template string.

   ```ts
   async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
     const query = getTemplateSrv().replace('SELECT * FROM services WHERE id = "$service"'), options.scopedVars);

     const data = makeDbQuery(query);

     return { data };
   }
   ```

## Add support for variable queries to your data source

[Query variables]({{< relref "../../variables/variable-types/add-query-variable/" >}}) is a type of variable that allows you to query a data source for the values. By adding support for variable queries to your data source plugin, users can create dynamic dashboards based on data from your data source.

For a data source to support query variables you need to override the [`metricFindQuery`]({{< relref "../../packages_api/data/datasourceapi.md#metricfindquery-method" >}}) in your data source class. `metricFindQuery` returns an array of [`MetricFindValue`]({{< relref "../../packages_api/data/metricfindvalue.md" >}}) which has a single property, `text`.

```ts
async metricFindQuery(query: any, options?: any) {
  // Retrieve DataQueryResponse based on query.
  const response = await this.doQuery(query);

  // Convert query results to a MetricFindValue[]
  const values = response.data.map(frame => ({ text: frame.name }));

  return values;
}
```
