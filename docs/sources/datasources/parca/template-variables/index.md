---
description: Use template variables with the Parca data source in Grafana.
keywords:
  - grafana
  - parca
  - template variables
  - variables
  - dashboard variables
  - profiling
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Parca template variables
weight: 400
review_date: 2026-04-10
---

# Parca template variables

Instead of hard-coding label values in your profiling queries, you can use template variables to create dynamic, reusable dashboards. Variables appear as drop-down menus at the top of the dashboard, making it easy to switch between services, instances, or environments without editing queries.

For an introduction to template variables, refer to the [Variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) documentation.

## Supported variable types

| Variable type | Supported | Notes                                                                        |
| ------------- | --------- | ---------------------------------------------------------------------------- |
| Custom        | Yes       | Define a static list of values manually.                                     |
| Text box      | Yes       | Enter a free-form value at the top of the dashboard.                         |
| Constant      | Yes       | Define a hidden, fixed value.                                                |
| Data source   | Yes       | Select a data source instance by name.                                       |
| Query         | No        | Parca doesn't implement variable queries to dynamically populate drop-downs. |

{{< admonition type="note" >}}
Parca doesn't support query-type variables. You can't use the Parca data source to dynamically populate variable drop-downs. Use custom variables to define values manually, or use another data source to populate query variables.
{{< /admonition >}}

## Use variables in the label selector

The Parca query editor's label selector field supports template variable interpolation. Use the standard `$variablename` or `${variablename}` syntax. Variables are interpolated in the label selector only -- the profile type drop-down doesn't support them.

### Variable syntax options

| Syntax                   | Description                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `$variablename`          | Simple syntax for most cases.                                                    |
| `${variablename}`        | Use when the variable is adjacent to other text (for example, `${host}_suffix`). |
| `${variablename:format}` | Apply a specific format to the variable value.                                   |

## Example: Filter profiles by service

Create a custom variable to switch between services in your profiling dashboard.

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Set **Type** to **Custom**.
1. Enter a **Name**, for example `service`.
1. In the **Custom options** field, enter comma-separated values, for example `frontend, backend, api-gateway`.
1. Click **Apply**.

In your Parca query's label selector, reference the variable:

```text
{job="$service"}
```

When you change the drop-down selection, the panel refreshes to show profiles for the selected service.

## Example: Filter by service and instance

Create two custom variables to filter by multiple dimensions.

1. Create a variable named `service` with custom values `frontend, backend, api-gateway`.
1. Create a second variable named `instance` with custom values for your instance addresses, for example `10.0.0.1:7070, 10.0.0.2:7070, 10.0.0.3:7070`.

In your Parca query's label selector, reference both variables:

```text
{job="$service", instance="$instance"}
```

## Example: Use a text box variable for free-form filtering

Create a text box variable for free-form label filtering.

1. Navigate to **Dashboard settings** > **Variables**.
1. Click **Add variable**.
1. Set **Type** to **Text box**.
1. Enter a **Name**, for example `label_filter`.
1. Optionally set a default value, for example `job="my-service"`.
1. Click **Apply**.

In your Parca query's label selector, reference the variable:

```text
{$label_filter}
```

This lets you type any label matcher directly into the variable input at the top of the dashboard without editing the panel query.

## Limitations

Parca template variable support has the following limitations:

- **No query variable support:** You can't use Parca as a data source for populating variable options. Define values manually with custom variables or use another data source.
- **Label selector only:** Variables are interpolated in the label selector field. The profile type drop-down doesn't support variables.
- **No free-form filters:** Parca doesn't support [free-form filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters).

## Next steps

- [Build queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/query-editor/) using your template variables.
- [Troubleshoot issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/parca/troubleshooting/) if queries aren't returning expected data.
