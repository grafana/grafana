---
labels:
  products:
    - enterprise
    - oss
title: Create a new correlation
weight: 40
---

# Create a new correlation

## Before you begin

Make sure you have permission to add new correlations. Only users with write permissions to data sources can define new correlations.

## Create a correlation in Explore's Correlations Editor

1. Go to Explore page.
1. Select a data source that you would like to be [the source data source]({{< relref "/docs/grafana/latest/administration/correlations/correlation-configuration#source-data-source-and-result-field" >}}) for a new correlation.
1. Run a query producing data in [a supported visualization]({{< relref "/docs/grafana/latest/administration/correlations/#correlations" >}}).
1. Click "+ Add" button in the top toolbar and select "Add correlation" (you can also select "Correlations Editor" from the [Command Palette]({{< relref "/docs/grafana/latest/search/#command-palette" >}})).
1. Explore is now in Correlations Editor mode indicated by a blue border and top bar. You can exit Correlations Editor using the Exit button in the top bar.
1. The visualization is enriched with links allowing to create new correlations. Links are attached to the data that you can use to build a new query:
   - Logs: links are displayed next to field values inside log details for each log row
   - Table: every table cell is a link
1. Click on a link to begin adding new correlation. Links are associated with a field that will be used as [a results field of a correlation]({{< relref "/docs/grafana/latest/administration/correlations/correlation-configuration" >}}). This means the correlation link will be created on the link you select once the correlation is saved.
1. Explore opens a split view. Use the right pane to setup [the target query source of the correlation]({{< relref "/docs/grafana/latest/administration/correlations/correlation-configuration#target-query" >}}).
1. Build target query using [variables syntax]({{< relref "/docs/grafana/latest/dashboards/variables/variable-syntax" >}}) with variables from the list provided at the top of the pane. The list contains sample values from the selected data row.
1. Provide optional label and description. Label is used as the name of the link inside the visualization. It can contain variables.
1. Click "Save" button in the top bar to save the correlation and exit Correlations Editor mode.
1. The link used to create the correlation will be replaced with a data link in each row. The variables will be dynamically replaced with values from a selected row.

Please check [an example]({{< relref "/docs/grafana/latest/administration/correlations/use-correlations-editor-in-explore" >}}) to see how to create a sample correlation using test data source.

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
: The field that will be transformed. If this is not defined, it will apply the transformation to the data from the correlation's config.field.

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
