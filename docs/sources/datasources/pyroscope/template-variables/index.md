---
description: Use template variables with the Grafana Pyroscope data source to build dynamic, reusable dashboards.
keywords:
  - grafana
  - pyroscope
  - profiling
  - templates
  - variables
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Grafana Pyroscope template variables
menuTitle: Template variables
weight: 450
review_date: 2026-07-08
---

# Grafana Pyroscope template variables

Template variables let you create dynamic, reusable dashboards by replacing hard-coded values, such as service names or profile types, with selectable variables. Grafana displays these variables as drop-down menus at the top of the dashboard, letting viewers change the displayed data without editing queries.

For an introduction to templating and template variables, refer to [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/).

## Query variable types

Query variables query the Pyroscope data source to populate drop-down values. When you create a query variable, select a Pyroscope data source and choose a query type.

| Query type       | Required inputs                    | Description                                                                                          |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Profile type** | None                              | Returns the profile types available from the data source, such as `process_cpu:cpu:nanoseconds:cpu:nanoseconds`. |
| **Label**        | Profile type                      | Returns the label names available for the selected profile type.                                    |
| **Label value**  | Profile type, label               | Returns the values for a selected label, scoped to the selected profile type.                       |

## Create a query variable

To create a query variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Select **Add variable**.
1. Set **Select variable type** to **Query**.
1. Select the Pyroscope data source.
1. Select a **Query type** of **Profile type**, **Label**, or **Label value**.
1. For a **Label** or **Label value** query, select a **Profile type**.
1. For a **Label value** query, select a **Label**.
1. Select **Apply** to save the variable.

## Query variable examples

The following examples show common ways to use Pyroscope query variables.

**Populate a drop-down with profile types:**

1. Set **Query type** to **Profile type**.
1. The variable drop-down now lists every profile type the data source reports, such as `process_cpu:cpu:nanoseconds:cpu:nanoseconds` and `memory:alloc_space:bytes:space:bytes`.

**Populate a drop-down with services:**

1. Set **Query type** to **Label value**.
1. Set **Profile type** to a profile type, such as `process_cpu:cpu:nanoseconds:cpu:nanoseconds`.
1. Set **Label** to `service_name`.
1. The variable drop-down now lists the values of the `service_name` label.

## Use variables in queries

After you create a variable, reference it in the query editor's label selector using the `$variable` or `${variable}` syntax.

For example, if you have a variable named `service` created with the **Label value** query type on the `service_name` label, use it in the label selector:

```
{service_name="$service"}
```

When **Multi-value** or **Include All** is enabled for the variable, the value becomes a regular expression pattern, such as `value1|value2`. Use the `=~` operator instead of `=` in your label selector:

```
{service_name=~"$service"}
```

## Filters variable

The Pyroscope data source supports the [Filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters) variable type, which lets dashboard viewers add label filters without editing queries.

To set up a Filters variable:

1. Navigate to **Dashboard settings** > **Variables**.
1. Select **Add variable**.
1. Set **Select variable type** to **Filters**.
1. Select the Pyroscope data source.
1. Select **Apply** to save the variable.

After you add the variable, a filter bar appears at the top of the dashboard. Viewers can add filters by selecting a label, an operator (`=`, `!=`, `=~`, `!~`), and a value. Grafana applies these filters to all Pyroscope queries on the dashboard.

## Related resources

- [Query profile data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/query-editor/): Use variables in the label selector.
- [Troubleshoot the Pyroscope data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/pyroscope/troubleshooting/): Resolve variable-related query issues.
