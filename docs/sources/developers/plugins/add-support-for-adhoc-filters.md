+++
title = "Ad-hoc filters for data source plugins"
+++

# Ad-hoc filters for data source plugins

If your data source supports filtering, such as `WHERE` for SQL, consider adding support for [ad-hoc filters](TODO).

## Add support for ad-hoc filters variables to your data source

To use your data source for populating ad-hoc filter variables, it needs to implement the `getTagKeys` and `getTagValues` methods from DataSourceApi.

`getTagKeys` returns an array of keys that the can be used to filter on.

```ts
async getTagKeys(): Promise<MetricFindValue[]> {
  return [
    { text: 'Organization' },
    { text: 'Project' },
  ];
}
```

`getTagValues` is called whenever the user lists the values for a specific key. The `options` argument has a property called `key`, which corresponds to the `text` property of the selected tag key. You can use the `key` to determine the values that should be returned for that key.

```ts
async getTagValues(options: any): Promise<MetricFindValue[]> {
  switch (options.key) {
    case 'Organization':
      return [{ text: 'Grafana Labs' }];
    case 'Project':
      return [{ text: 'Grafana' }, { text: 'Loki' }, { text: 'Tempo' }];
    default:
      return [];
  }
}
```

## Use ad-hoc filters in your data source

Unlike other variable types, you don't interpolate ad-hoc filter variables. Instead, you list them using the `getVariables` method on `TemplateSrv`.

> **Note:** Because ad-hoc filters are not defined in the `VariableModel` interface, you must annotate the variable as `any` to access the `filters` property.

```ts
const adhocFilters = getTemplateSrv()
  .getVariables()
  .filter((variable) => variable.type === 'adhoc')
  .flatMap((variable: any) => variable.filters);
```

The `adhocFilters` looks something like this:

```ts
[
  {
    condition: "",
    key: "Organization",
    operator: "=",
    value: "Grafana Labs"
  },
  {
    condition: "",
    key: "Project",
    operator: "=",
    value: "Grafana"
  }
]
```

The next step is to map the defined filters to the query. This depends on the query language that is used by your data source.
