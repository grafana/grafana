+++
title = "Data link variables"
keywords = ["grafana", "url variables", "documentation", "variables", "data link"]
aliases = ["/docs/grafana/latest/variables/data-link-variables.md"]
weight = 400
+++

# Data link variables

You can use variables in data links to refer to series fields, labels, and values. For more information about data links, refer to [Data links]({{< relref "data-links.md" >}}).

To see a list of available variables, type `$` in the data link **URL** field.

> **Note:** These variables changed in 6.4 so if you have an older version of Grafana, then use the version picker to select docs for an older version of Grafana.

## Time range panel variables

These variables allow you to include the current time range in the data link URL.

- `__url_time_range` - current dashboard's time range (i.e. `?from=now-6h&to=now`)
- `$__from and $__to` - For more information, refer to [Global variables]({{< relref "../variables/variable-types/global-variables.md#__from-and-__to" >}}).

## Series variables

Series specific variables are available under `__series` namespace:

- `__series.name` - series name to the URL

## Field variables

Field-specific variables are available under `__field` namespace:

- `__field.name` - the name of the field
- `__field.labels.<LABEL>` - label's value to the URL. If your label contains dots, then use `__field.labels["<LABEL>"]` syntax.

## Value variables

Value-specific variables are available under `__value` namespace:

- `__value.time` - value's timestamp (Unix ms epoch) to the URL (i.e. `?time=1560268814105`)
- `__value.raw` - raw value
- `__value.numeric` - numeric representation of a value
- `__value.text` - text representation of a value
- `__value.calc` - calculation name if the value is result of calculation

## Template variables

You can also use template variables in data link URLs. For more information, refer to [Templates and variables]({{< relref "../variables/_index.md" >}}).

When linking to another dashboard that uses template variables, select variable values to apply them for whoever clicks the link.

- `${myvar:queryparams}` - where `myvar` matches the name of the desired template variable in the current dashboard

  > **Note:** This example uses advanced variable formatting to convert variables, including those with multiple values, into query parameters. For more information, refer to [Advanced variable format options](https://grafana.com/docs/grafana/latest/variables/advanced-variable-format-options/).

- `__all_variables` - add all of the current dashboard's variables to the URL
