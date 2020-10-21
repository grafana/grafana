+++
title = "URL variables"
keywords = ["grafana", "url variables", "documentation", "variables", "data link"]
aliases = ["/docs/grafana/latest/variables/url-variables.md","/docs/grafana/latest/variables/variable-types/url-variables.md"]
type = "docs"
weight = 400
+++

# Data link variables

You can use variables in data links to refer to series fields, labels, and values. For more information about data links, refer to [Data links]({{< relref "data-links.md" >}}).

To see a list of available variables, type `$` in the data link **URL** field to see a list of variables that you can use.

> **Note:** These variables changed in 6.4 so if you have an older version of Grafana, then use the version picker to select docs for an older version of Grafana.

You can also use template variables in your data links URLs, refer to [Templates and variables]({{< relref "../variables/_index.md" >}}) for more information on template variables.

## Time range panel variables

These variables allow you to include the current time range in the data link URL.

- ``__url_time_range`` - current dashboard's time range (i.e. ``?from=now-6h&to=now``)
- `$__from and $__to` - For more information, refer to [Global variables]({{< relref "../variables/variable-types/global-variables.md#__from-and-__to" >}}).

## Series variables

Series specific variables are available under ``__series`` namespace:

- ``__series.name`` - series name to the URL
- ``__series.labels.<LABEL>`` - label's value to the URL. If your label contains dots, then use ``__series.labels["<LABEL>"]`` syntax.

## Field variables

Field-specific variables are available under ``__field`` namespace:

- ``__field.name`` - the name of the field

## Value variables

Value-specific variables are available under ``__value`` namespace:

- ``__value.time`` - value's timestamp (Unix ms epoch) to the URL (i.e. ``?time=1560268814105``)
- ``__value.raw`` - raw value
- ``__value.numeric`` - numeric representation of a value
- ``__value.text`` - text representation of a value
- ``__value.calc`` - calculation name if the value is result of calculation

## Template variables

When linking to another dashboard that uses template variables, select variable values for whoever clicks the link.

``var-myvar=${myvar}`` - where ``myvar`` is a name of the template variable that matches one in the current dashboard that you want to use. 

If you want to add all of the current dashboard's variables to the URL, then use  ``__all_variables``.
