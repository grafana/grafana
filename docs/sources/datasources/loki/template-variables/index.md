---
aliases:
  - ../../data-sources/loki/template-variables/
description: Guide for using template variables when querying the Loki data source
keywords:
  - grafana
  - loki
  - logs
  - queries
  - template
  - variable
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Loki template variables
weight: 300
review_date: 2026-07-29
---

# Loki template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/) documentation.

## Use query variables

Variables of the type _Query_ help you query Loki for lists of labels or label values.
The Loki data source provides a form to select the type of values expected for a given variable.

The form has these options:

| Query type   | Example label | Example stream selector | List returned                                                    |
| ------------ | ------------- | ----------------------- | ---------------------------------------------------------------- |
| Label names  | Not required  | Not required            | Label names.                                                     |
| Label values | `label`       |                         | Label values for `label`.                                        |
| Label values | `label`       | `log stream selector`   | Label values for `label` in the specified `log stream selector`. |

### Query variable example

To create a variable that lists the values of the `app` label:

1. Add a new variable of type _Query_ and select the Loki data source.
1. Set **Query type** to **Label values** and **Label** to `app`.
1. Optionally, enter a **Stream selector** such as `{namespace="$namespace"}` to return only the values that appear within another variable's selection. This creates a chained variable that updates when the parent variable changes.

Reference the variable in a query with its name, prefixed by `$`. For a single-value variable, use an exact match:

```logql
{app="$app"}
```

When a variable has **Multi-value** or **Include All** enabled, Grafana joins the selected values into a regular expression, such as `payments|checkout`. Use the regex match operator `=~` so the query matches any of the selected values:

```logql
{app=~"$app"}
```

## Format variable values

By default, the Loki data source formats variable values based on the variable's settings:

- A single-value variable is inserted as-is, without escaping.
- A **Multi-value** or **Include All** variable has each value escaped for use in a regular expression and joined with `|`, for example `payments|checkout`.

This default suits the regex match operator `=~`, but it can produce unexpected results when a custom or static value contains characters that Grafana escapes, or when you insert a value into a context that isn't a regular expression. To control the formatting, use a [format option](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options) in the variable syntax:

| Syntax         | Result                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `${app:raw}`   | Inserts the value with no escaping. Use this for custom or static values that must pass through unchanged. |
| `${app:pipe}`  | Joins multiple values with `\|` without regex escaping.                                                    |
| `${app:regex}` | Escapes the values for a regular expression and joins them with `\|`.                                      |

For example, to use a raw custom value in an exact-match selector:

```logql
{app="${app:raw}"}
```

For the complete list of format options, refer to [Advanced variable format options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#advanced-variable-format-options).

## Use ad hoc filters

Loki supports ad hoc filters. Use them to specify any number of key/value filters that Grafana applies automatically to all of your Loki queries, without editing each query.

For example, if you add an ad hoc filter for `level = error`, Grafana appends the matcher to the stream selector of every Loki query on the dashboard, so a query like `{app="payments"}` runs as `{app="payments", level="error"}`.

For more information, refer to [Add ad hoc filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters).

## Use $\_\_auto variable for Loki metric queries

Consider using the `$__auto` variable in your Loki metric queries, which will automatically be substituted with the [step value](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/#options) for range queries, and with the selected time range's value (computed from the starting and ending times) for instant queries.

Use it as the range in a range aggregation:

```logql
sum(rate({app="payments"} |= `error` [$__auto]))
```

{{< admonition type="note" >}}
Prefer `$__auto` over `$__range` for the range in a metric query. The `$__range` variable resolves to the entire selected time range, so using it as a range vector, such as `[$__range]`, makes each data point aggregate over the whole window. This can scan far more data and extend the effective lookback beyond what you intend.
{{< /admonition >}}

For more information about variables, refer to [Global built-in variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables).

## Known limitations

Keep the following limitations in mind when you use template variables with the Loki data source:

- **Only indexed labels are available for label variable queries.** A _Query_ variable of type **Label values** returns the values of indexed stream labels. Values that exist only as parsed fields or [structured metadata](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/) aren't available, because the variable query doesn't run a log pipeline to extract them.
- **Long time ranges can return incomplete values.** Label and label-value variable queries run over the dashboard's selected time range. Over a long range with high log volume, the query can time out or hit Loki's limits and return an incomplete list of values. Narrow the time range, or add a stream selector to the variable query, so it scans less data.

## Label extraction and indexing in Loki

Labels are key to how Loki aggregates and queries logs. Labels are `key-value` pairs that add contextual information to log entries, and Loki uses them to organize, filter, and search log data efficiently.

### Label extraction

When it ingests logs, Loki extracts labels from log lines using regular expressions, so you can define custom patterns that match your log formats. For example, given a log line like the following:

```text
2023-07-25 12:34:56 INFO: Request from IP A.B.C.D to endpoint /api/data
```

You can define a regular expression that extracts the log level (`INFO`), IP address (`A.B.C.D`), and endpoint (`/api/data`) as labels. You can then use those labels to filter and aggregate log entries.

### Index labels

Loki indexes the extracted labels. The index maps labels to their log entries, so Loki can retrieve logs by label without scanning the entire dataset. For example, if a `job` label represents the services in your application, Loki indexes each job's logs separately, so you can query a single job quickly.

Combine Loki's indexed labels with Grafana template variables to build dynamic queries. Use template variables to select and filter logs by labels such as job names, instance IDs, or severity levels, so you can explore and visualize your log data interactively.
