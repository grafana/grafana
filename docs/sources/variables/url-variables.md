+++
title = "URL variables"
keywords = ["grafana", "url variables", "documentation", "variables"]
type = "docs"
+++

# URL variables

You can use variables in data links to link to specific portions of your visualizations. For more information about data links, refer to [Data links]({{< relref "../linking/data-links.md" >}}).

> **Note:** These variables changed in 6.4 so if you have an older version of Grafana please use the version picker to select
docs for an older version of Grafana.

## Typeahead suggestions

Press Cmd+Space or Ctrl+Space on your keyboard to open the typeahead suggestions to more easily add variables to your URL.

{{< docs-imagebox img="/img/docs/data_link_typeahead.png"  max-width= "800px" >}}

## Time variables

* ``__url_time_range`` - current dashboard's time range (i.e. ``?from=now-6h&to=now``)
* ``__from`` - current dashboard's time range from value
* ``__to`` - current dashboard's time range to value

## Series variables

Series specific variables are available under ``__series`` namespace:

* ``__series.name`` - series name to the URL
* ``__series.labels.<LABEL>`` - label's value to the URL. If your label contains dots use ``__series.labels["<LABEL>"]`` syntax

## Field variables

Field specific variables are available under ``__field`` namespace:

* ``__field.name`` - field name to the URL

## Value variables

Value specific variables are available under ``__value`` namespace:

* ``__value.time`` - value's timestamp (Unix ms epoch) to the URL (i.e. ``?time=1560268814105``)
* ``__value.raw`` - raw value
* ``__value.numeric`` - numeric representation of a value
* ``__value.text`` - text representation of a value
* ``__value.calc`` - calculation name if the value is result of calculation

## Template variables

When linking to another dashboard that uses template variables, you can use ``var-myvar=${myvar}`` syntax (where ``myvar`` is a name of template variable)
to use current dashboard's variable value. If you want to add all of the current dashboard's variables to the URL use  ``__all_variables`` variable.
