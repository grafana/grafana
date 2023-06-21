---
aliases:
  - ../../data-sources/graphite/template-variables/
description: Guide for using template variables when querying the Graphite data source
keywords:
  - grafana
  - graphite
  - queries
  - template
  - variable
menuTitle: Template variables
title: Graphite template variables
weight: 300
---

# Graphite template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../../dashboards/variables" >}}) and [Add and manage variables]({{< relref "../../../dashboards/variables/add-template-variables" >}}) documentation.

## Select a query type

There are three query types for Graphite template variables

| Query Type        | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| Default Query     | Use functions such as `tags()`, `tag_values()`, `expand(<metric>)` and metrics. |
| Value Query       | Returns all the values for a query that includes a metric and function.         |
| Metric Name Query | Returns all the names for a query that includes a metric and function.          |

## Use tag variables

To create a variable using tag values, use the Grafana functions `tags` and `tag_values`.

| Query                                   | Description                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `tags()`                                | Returns all tags.                                                                                  |
| `tags(server=~backend\*)`               | Returns only tags that occur in series matching the filter expression.                             |
| `tag_values(server)`                    | Returns tag values for the specified tag.                                                          |
| `tag_values(server, server=~backend\*)` | Returns filtered tag values that occur for the specified tag in series matching those expressions. |

Multiple filter expressions and expressions can contain other variables. For example:

```
tag_values(server, server=~backend\*, app=~${apps:regex})
```

For details, refer to the [Graphite docs on the autocomplete API for tags](http://graphite.readthedocs.io/en/latest/tags.html#auto-complete-support).

### Use multi-value variables in tag queries

Multi-value variables in tag queries use the advanced formatting syntax for variables introduced in Grafana v5.0: `{var:regex}`.
Non-tag queries use the default glob formatting for multi-value variables.

#### Tag expression example

**Using regex formatting and the Equal Tilde operator, `=~`:**

```text
server=~${servers:regex}
```

For more information, refer to [Advanced variable format options]({{< relref "../../../dashboards/variables/variable-syntax#advanced-variable-format-options" >}}).

## Use other query variables

When writing queries, use the metric find type of query.

For example, a query like `prod.servers.*` fills the variable with all possible values that exist in the wildcard position.

The results contain all possible values occurring only at the last level of the query.
To get full metric names matching the query, use the `expand` function: `expand(*.servers.*)`.

### Compare expanded and non-expanded metric search results

The expanded query returns the full names of matching metrics.
In combination with regular expressions, you can use it to extract any part of the metric name.
By contrast, a non-expanded query returns only the last part of the metric name, and doesn't let you extract other parts of metric names.

Given these example metrics:

- `prod.servers.001.cpu`
- `prod.servers.002.cpu`
- `test.servers.001.cpu`

These examples demonstrate how expanded and non-expanded queries can fetch specific parts of the metrics name:

| Non-expanded query | Results    | Expanded query            | Expanded results                                                 |
| ------------------ | ---------- | ------------------------- | ---------------------------------------------------------------- |
| `*`                | prod, test | `expand(*)`               | prod, test                                                       |
| `*.servers`        | servers    | `expand(*.servers)`       | prod.servers, test.servers                                       |
| `test.servers`     | servers    | `expand(test.servers)`    | test.servers                                                     |
| `*.servers.*`      | 001,002    | `expand(*.servers.*)`     | prod.servers.001, prod.servers.002, test.servers.001             |
| `test.servers.*`   | 001        | `expand(test.servers.*)`  | test.servers.001                                                 |
| `*.servers.*.cpu`  | cpu        | `expand(*.servers.*.cpu)` | prod.servers.001.cpu, prod.servers.002.cpu, test.servers.001.cpu |

The non-expanded query is the same as an expanded query, with a regex matching the last part of the name.

You can also create nested variables that use other variables in their definition.
For example, `apps.$app.servers.*` uses the variable `$app` in its query definition.

### Use `__searchFilter` to filter query variable results

{{% admonition type="note" %}}
Available in Grafana v6.5 and higher.
{{% /admonition %}}

You can use `__searchFilter` in the query field to filter the query result based on what the user types in the dropdown select box.
The default value for `__searchFilter` is `*` if you've not entered anything, and `` when used as part of a regular expression.

#### Search filter example

To use `__searchFilter` as part of the query field to enable searching for `server` while the user types in the dropdown select box:

Query

```bash
apps.$app.servers.$__searchFilter
```

TagValues

```bash
tag_values(server, server=~${__searchFilter:regex})
```

## Choose a variable syntax

![variable](/static/img/docs/v2/templated_variable_parameter.png)

The Graphite data source supports two variable syntaxes for use in the **Query** field:

- `$<varname>`, for example `apps.frontend.$server.requests.count`, which is easier to read and write but does not allow you to use a variable in the middle of a word.
- `${varname}`, for example `apps.frontend.${server}.requests.count`, to use in expressions like `my.server${serverNumber}.count`.

### Templated dashboard example

To view an example templated dashboard, refer to [Graphite Templated Dashboard](https://play.grafana.org/dashboard/db/graphite-templated-nested).
