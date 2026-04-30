---
description: Use template variables with the TestData data source in Grafana.
keywords:
  - grafana
  - testdata
  - template variables
  - variables
  - dashboard variables
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: TestData template variables
weight: 300
review_date: '2026-04-08'
---

# TestData template variables

Use template variables with the TestData data source to test dynamic, reusable dashboards. TestData provides a hierarchical metric tree that you can query to populate variable drop-downs with simulated values.

For an introduction to templating and template variables, refer to the [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/) documentation.

## Supported variable types

| Variable type | Supported |
| ------------- | --------- |
| Query         | Yes       |
| Custom        | Yes       |
| Data source   | Yes       |

## Create a query variable

To create a query variable using TestData:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Query** as the variable type.
1. Select the **TestData** data source.
1. Enter your query in the **Query** field.

## Metric tree queries

TestData generates a hierarchical metric tree with nodes named using letter combinations. The tree has 6 levels of depth, with each level containing 8 nodes labeled A through H. The query string navigates this tree using dot-separated path segments.

### Query syntax

Use `*` as a wildcard to return all children at a given level:

| Query    | Result                                                                      |
| -------- | --------------------------------------------------------------------------- |
| `*`      | Returns the top-level nodes: `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`.        |
| `A.*`    | Returns children of node A: `AA`, `AB`, `AC`, `AD`, `AE`, `AF`, `AG`, `AH`. |
| `A.AA.*` | Returns children of node AA: `AAA`, `AAB`, `AAC`, etc.                      |
| `A.AB`   | Returns children of the AB node: `ABA`, `ABB`, `ABC`, etc.                  |

Use glob patterns with curly braces to match multiple nodes:

| Query         | Result                                                               |
| ------------- | -------------------------------------------------------------------- |
| `{A,B}.*`     | Returns children of both A and B: `AA`, `AB`, ..., `BA`, `BB`, etc.  |
| `A.{AA,AB}.*` | Returns children of AA and AB: `AAA`, `AAB`, ..., `ABA`, `ABB`, etc. |

Use `*` after a prefix to match nodes that start with the given string:

| Query | Result                                                                   |
| ----- | ------------------------------------------------------------------------ |
| `A*`  | Returns all top-level nodes starting with A (only `A` at the top level). |

### Value queries

If your query string starts with `value`, TestData returns the query string itself as the result. This is useful for creating variables with specific values for testing. For example, a query of `value_production` returns `value_production`.

## Example: Create a region variable

This example walks through creating a query variable that populates a drop-down with simulated region values, then using it in a panel query.

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Set **Type** to **Query**.
1. Select the **TestData** data source.
1. Enter `*` in the **Query** field. This populates the variable with the top-level nodes (A through H).
1. Name the variable `region`.
1. Click **Apply**.

To use the variable in a panel:

1. Add a new panel and select the **TestData** data source.
1. Choose the **Random Walk** scenario.
1. In the **Labels** field, enter `region=$region`.
1. The panel updates when you select a different value from the **region** drop-down.

## Example: Chain variables for cascading drop-downs

You can create dependent variables where one variable's query references another, producing cascading drop-downs.

1. Create a variable named `region` with the query `*`. This returns the top-level nodes (A through H).
1. Create a second variable named `host` with the query `$region.*`. When the user selects `A` as the region, the host drop-down populates with `AA`, `AB`, `AC`, etc.

Changing the region selection automatically refreshes the host drop-down.

## Use variables in queries

TestData interpolates template variables in the following query fields:

- **Labels**
- **Alias**
- **Scenario**
- **String Input**
- **CSV Content**
- **Raw Frame Content**

Use the standard Grafana variable syntax (`$varname` or `${varname}`) in any of these fields to insert variable values.

### Example

With a variable named `env` set to `production`, entering `env=$env` in the **Labels** field produces a series labeled `env=production`.

## Limitations

TestData doesn't support the [filters variable](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters). Filters require the data source to implement tag key and value lookups, which TestData doesn't provide.
