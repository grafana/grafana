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
review_date: "2026-04-08"
---

# TestData template variables

Use template variables with the TestData data source to test dynamic, reusable dashboards. TestData provides a hierarchical metric tree that you can query to populate variable drop-downs with simulated values.

For an introduction to templating and template variables, refer to the [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/) documentation.

## Supported variable types

| Variable type   | Supported |
| --------------- | --------- |
| Query           | Yes       |
| Custom          | Yes       |
| Data source     | Yes       |

## Create a query variable

To create a query variable using TestData:

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Select **Query** as the variable type.
1. Select the **TestData** data source.
1. Enter your query in the **Query** field.

## Metric tree queries

TestData generates a hierarchical metric tree with nodes named using letter combinations. The tree has up to 5 levels of depth, with each level containing nodes labeled A through H.

The query string navigates this tree using dot-separated path segments. Use `*` as a wildcard to return all children at a given level.

### Query examples

| Query     | Result                                                            |
| --------- | ----------------------------------------------------------------- |
| `*`       | Returns the top-level nodes: `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`. |
| `A.*`     | Returns children of node A: `AA`, `AB`, `AC`, `AD`, `AE`, `AF`, `AG`, `AH`. |
| `A.AA.*`  | Returns children of node AA: `AAA`, `AAB`, `AAC`, etc.            |
| `A.AB`    | Returns children of the AB node.                                  |

You can also use glob patterns with curly braces to match multiple nodes:

| Query         | Result                              |
| ------------- | ----------------------------------- |
| `{A,B}.*`     | Returns children of both A and B.   |
| `A.{AA,AB}.*` | Returns children of AA and AB.      |

Prefix wildcards match nodes that start with the given string:

| Query    | Result                                                |
| -------- | ----------------------------------------------------- |
| `A*`     | Returns all top-level nodes starting with A (that is, just `A`). |
| `A.A*`   | Returns children of A that start with A: `AA`, `AB`, etc.|

### Value queries

If your query string starts with `value`, TestData returns the query string itself as the result. For example, a query of `value_1` returns `value_1`.

## Use variables in queries

TestData interpolates template variables in the following query fields:

- **Labels**
- **Alias**
- **Scenario**
- **String Input**
- **CSV Content**
- **Raw Frame Content**

Use the standard Grafana variable syntax (`$varname` or `${varname}`) in any of these fields to insert variable values.
