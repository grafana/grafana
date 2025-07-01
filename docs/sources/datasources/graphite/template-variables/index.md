---
aliases:
  - ../../data-sources/graphite/template-variables/
description: Guide for using template variables when querying the Graphite data source.
keywords:
  - grafana
  - graphite
  - queries
  - template
  - variable
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Graphite template variables
weight: 300
refs:
  add-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  variable-syntax-advanced-variable-format-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options
---

# Graphite template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in drop-down selection boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating](ref:variables) and [Add and manage variables](ref:add-template-variables) documentation.

To view an example templated dashboard, refer to [Graphite Templated Nested dashboard](https://play.grafana.org/d/cvDFGseGz/graphite-templated-nested).

## Use query variables

With Graphite data sources, you can only create query variables. Grafana supports three specific query types for Graphite-based variables:

| Query type            | Description                                                                            | Example usage                            |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Default query**     | Allows you to dynamically list metrics, nodes, or tag values using Graphite functions. | `tag_values(apps.*.requests.count, app)` |
| **Value query**       | Returns all the values for a query that includes a metric and function.                | `tag_values(apps.*.status.*, status)`    |
| **Metric name query** | Returns all the names for a query that includes a metric and function.                 | `apps.*.requests.count`                  |

### Choose a variable syntax

The Graphite data source supports two variable syntaxes for use in the **Query** field.

![Variable syntax example](/static/img/docs/v2/templated_variable_parameter.png)

Grafana allows two ways to reference variables in a query:

| **Syntax**   | **Example**                              |
| ------------ | ---------------------------------------- |
| `$varname`   | `apps.frontend.$server.requests.count`   |
| `${varname}` | `apps.frontend.${server}.requests.count` |

- **Shorthand syntax (`$varname`)** is convenient for simple paths but doesn't work when the variable is adjacent to characters (e.g., `cpu$coreLoad`).
- **Full syntax (`${varname}`)** is more flexible and works in any part of the string, including embedded within words.

Choose the format that best fits the structure of your Graphite metric path.

## Use tag variables

Grafana supports tag-based variables for Graphite, allowing you to dynamically populate drop-downs based on tag keys and values in your metric series. To do this, use the Graphite functions `tags()` and `tag_values()` in your variable queries.

| Query                                   | Description                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `tags()`                                | Returns a list of all tag keys in the Graphite database.                                   |
| `tags(server=~backend\*)`               | Returns tag keys only from series that match the provided filter expression.               |
| `tag_values(server)`                    | Returns all values for the specified tag key.                                              |
| `tag_values(server, server=~backend\*)` | Returns tag values for a given key, filtered to only those that appear in matching series. |

You can use multiple filter expressions, and those expressions can include other Grafana variables. For example:

```
tag_values(server, server=~backend\*, app=~${apps:regex})
```

This query returns all server tag values from series where the `server` tag matches backend\* and the `app` tag matches the regex-filtered values from another variable ${apps}.

For details, refer to the [Graphite docs on the autocomplete API for tags](http://graphite.readthedocs.io/en/latest/tags.html#auto-complete-support).

**Using regular expression formatting and the equal tilde operator `=~`:**

```
server=~${servers:regex}
```

This query tells Grafana to format the selected values in the `servers` variable as a regular expression (e.g., (`server1`|`server2`) if two servers are selected).

For more information, refer to [Advanced variable format options](ref:variable-syntax-advanced-variable-format-options).

### Filter with multiple expressions

When using multi-value variables in tag queries, append `${var:regex}` to the variable name to apply regex formatting.

```
tag_values(server, app=~${apps:regex})
```

This query returns only series where the app tag matches the selected values in $`{apps}`, formatted as a regular expression. `=~` is the regular expression operator

Non-tag queries use the default `glob` formatting for multi-value variables.

## Use other query variables

When writing queries, use the **metric find** query type to retrieve dynamic values.

For example, the query `prod.servers.*` populates the variable with all values that exist at the wildcard position (\*).

Note that the results include only the values found at the last level of the query path.

To return full metric paths that match your query, use the expand() function:

```
expand(*.servers.*).
```

### Compare expanded and non-expanded metric search results

When querying Graphite metrics in Grafana, you can choose between using an **expanded** or **non-expanded** query:

- **Expanded queries** (using the `expand()` function) return the **full metric paths** that match your query.
- **Non-expanded queries** return only the **last segment** of each matching metric path, which limits your ability to extract or filter based on deeper parts of the metric name.

Expanded queries are especially useful when working with regular expressions to match or extract specific parts of the metric path.

Suppose your Graphite database contains the following metrics:

- `prod.servers.001.cpu`
- `prod.servers.002.cpu`
- `test.servers.001.cpu`

The following table illustrates the difference between expanded and non-expanded queries:

| **Non-expanded query** | **Results**    | **Expanded query**        | **Expanded results**                                                   |
| ---------------------- | -------------- | ------------------------- | ---------------------------------------------------------------------- |
| `*`                    | `prod`, `test` | `expand(*)`               | `prod`, `test`                                                         |
| `*.servers`            | `servers`      | `expand(*.servers)`       | `prod.servers`, `test.servers`                                         |
| `test.servers`         | `servers`      | `expand(test.servers)`    | `test.servers`                                                         |
| `*.servers.*`          | `001`, `002`   | `expand(*.servers.*)`     | `prod.servers.001`, `prod.servers.002`, `test.servers.001`             |
| `test.servers.*`       | `001`          | `expand(test.servers.*)`  | `test.servers.001`                                                     |
| `*.servers.*.cpu`      | `cpu`          | `expand(*.servers.*.cpu)` | `prod.servers.001.cpu`, `prod.servers.002.cpu`, `test.servers.001.cpu` |

{{% admonition type="note" %}}
A non-expanded query query works like an expanded query but returns only the final segment of each matched metric.
{{% /admonition %}}

Grafana also supports **nested variables**, which allow you to reference other variables in a query.

For example:

```
apps.$app.servers.*
```

This query uses the selected value of the `$app` variable to dynamically filter the metric path. The variable `$app` contains one or more application names and `servers.*` matches all servers for the given application.

### Filter query variable results with `__searchFilter`

Grafana provides the variable `__searchFilter`, which you can use to dynamically filter query results based on what the user types into the variable drop-down.
When the drop-down is empty or blank, `__searchFilter` defaults to `*`, which means it returns all possible values. If you type a string, Grafana replaces `__searchFilter` with that input.

To use `__searchFilter` as part of the query field to enable searching for `server` while the user types in the drop-down select box:

Query:

```
apps.$app.servers.$__searchFilter
```

TagValues:

```
tag_values(server, server=~${__searchFilter:regex})
```
