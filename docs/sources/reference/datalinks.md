+++
title = "Data links"
keywords = ["grafana", "data links", "documentation", "playlist"]
type = "docs"
+++

# Data links

{{< docs-imagebox img="/img/docs/v66/datalinks_graph.png" max-width="1025px" caption="Data links" >}}

Data link allows adding dynamic links to the visualization. Those links can link to either another dashboard or to an external URL.

{{< docs-imagebox img="/img/docs/v66/datalinks.png" max-width="1025px" caption="Data links" >}}

Data link is defined by title, URL and a setting whether or not it should be opened in a new window.

* **Title** is a human readable label for the link that will be displayed in the UI.
* **URL** field allows the URL configuration for a given link. Apart from regular query params it also supports built-in variables and dashboard variables that you can choose from
available suggestions:

The link itself is accessible in different ways depending on the visualization. For the graph you need to click on a data point or line, for a panel like
Stat, Gauge or Bar Gauge you can click anywhere on the visualization to open the context menu.

Example with Bar Gauge panel
{{< docs-imagebox img="/img/docs/v66/datalinks_cover.png" max-width="1025px" caption="Data links" >}}

## Variables to use in your URL

> These variables changed in 6.4 so if you have an older version of Grafana please use the version picker to select
docs for an older version of Grafana.

* ``__url_time_range`` - current dashboard's time range (i.e. ``?from=now-6h&to=now``)
* ``__from`` - current dashboard's time range from value
* ``__to`` - current dashboard's time range to value

### Series variables

Series specific variables are available under ``__series`` namespace:

* ``__series.name`` - series name to the URL
* ``__series.labels.<LABEL>`` - label's value to the URL. If your label contains dots use ``__series.labels["<LABEL>"]`` syntax

### Field variables

Field specific variables are available under ``__field`` namespace:

* ``__field.name`` - field name to the URL

### Value variables
Value specific variables are available under ``__value`` namespace:

* ``__value.time`` - value's timestamp (Unix ms epoch) to the URL (i.e. ``?time=1560268814105``)
* ``__value.raw`` - raw value
* ``__value.numeric`` - numeric representation of a value
* ``__value.text`` - text representation of a value
* ``__value.calc`` - calculation name if the value is result of calculation

### Template variables

When linking to another dashboard that uses template variables, you can use ``var-myvar=${myvar}`` syntax (where ``myvar`` is a name of template variable)
to use current dashboard's variable value. If you want to add all of the current dashboard's variables to the URL use  ``__all_variables`` variable.

## Typeahead suggestions

Hit CMD or CTRL space on your keyboard to open the typeahead suggestions to more easily add variables to your URL.

{{< docs-imagebox img="/img/docs/data_link_typeahead.png"  max-width= "800px" >}}


