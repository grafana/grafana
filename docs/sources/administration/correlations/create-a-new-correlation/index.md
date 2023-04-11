---
title: Create a new correlation
weight: 40
---

# Create a new correlation

## Before you begin

Make sure you have permission to add new correlations. Only users with write permissions to data sources can define new correlations.

## Create a correlation in Administration page

1. Go to the Administration section in Grafana.
1. Open Correlations page.
1. Click the “Add” button in the top right corner.
1. Provide a **label** for the correlation.
1. Provide an optional **description**.
1. Go to the next page.
1. Provide **target data source**.
1. Provide **target query** using variables.
1. Go to the next page.
1. Provide **source data source**.
1. Provide **results field**.
1. Add transformations if you need variables that are not fields in the source data source.
1. Click “Add” to add a new transformation.
1. Select the type of a transformation.
1. Configure transformation depending on the selected type.
1. Save correlation.

You can edit correlation in the same way, but you cannot change the selected data sources.

## Create a correlation with provisioning

Provision correlations by extending provisioned data sources. Correlations are defined as a subsection of the source data source configuration:

```yaml
datasources:
  - name: Data source name # source data source
    ...
    jsonData:
    ...
    correlations:
      - targetUID: uid
        label: "test"
        description: "..."
        config:
          type: "query"
          target:
            expr: "..."
          field: "name"
          transformations:
            - type: regex
              field: "test"
              expression: /\w+/
              mapValue: "other"
            - type: logfmt
              field: "test"
```

Description of provisioning properties:

**targetUID**
: Target data source UID

**label**
: Link label

**description**
: Optional description

**config**
: Config object

**config.type**
: Correlation type. “query” is the only supported type at the moment

**config.target**
: [Target query model]({{< relref "#determine-target-query-model-structure" >}})

**config.field**
: Name of the field where link is shown

**config.transformations (list)**
: List of transformation objects

**transformation.type**
: regex, or logfmt

**transformation.field**
: Input field for the transformation

**transformation.expression**
: Regex expression (regex transformation only)

**transformation.mapValue**
: New name of the variable from the first regex match (regex transformation only)

### Determine target query model structure

When you set up a correlation with admin page you can use the target query editor. When you use provisioning you may need to know the structure of the target query which may not be well documented depending on the plugin. Here is a quick step-by-step guide on how to determine the target query model:

1. Open Explore.
1. Select the data source you want to use as the target of the correlation.
1. Open the inspector tab and select “Query”.
1. Run a sample query.
1. Inspect results.
1. Look for the “queries” list object. Each object is created using the query model structure defined by the data source. You can use the same structure in your provisioning file.

   {{< figure src="/static/img/docs/correlations/determine-target-query-structure-inspector-10-0.png" max-width="600px" caption="Query inspector with target query structure" >}}

   The query model in this example is represented by the first entry in the queries list. Properties “refId” and “datasource” are added to all queries in runtime and can be omitted:

   ```json
   {
     "scenario_id": "random_walk",
     "alias": "app",
     "seriesCount: 2
   }
   ```
