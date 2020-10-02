+++
title = "Variables"
keywords = ["grafana", "templating", "documentation", "guide", "template", "variable", "repeat"]
type = "docs"
[menu.docs]
identifier = "repeat-panel-rows"
parent = "variables"
weight = 800
+++

# Repeat panels or rows

Grafana lets you create dynamic dashboards using _template variables_. All variables in your queries expand to the current value of the variable before the query is sent to the database. Variables let you reuse a single dashboard for all your services.

Template variables can be very useful to dynamically change your queries across a whole dashboard. If you want
Grafana to dynamically create new panels or rows based on what values you have selected, you can use the *Repeat* feature.

## Grafana Play examples

You can see examples in the following dashboards:

- [Prometheus repeat](https://play.grafana.org/d/000000036/prometheus-repeat)
- [Repeated Rows Dashboard](https://play.grafana.org/dashboard/db/repeated-rows)

## Repeating panels

If you have a variable with `Multi-value` or `Include all value` options enabled you can choose one panel and have Grafana repeat that panel
for every selected value. You find the *Repeat* feature under the *General tab* in panel edit mode.

The `direction` controls how the panels will be arranged.

By choosing `horizontal` the panels will be arranged side-by-side. Grafana will automatically adjust the width
of each repeated panel so that the whole row is filled. Currently, you cannot mix other panels on a row with a repeated
panel.

Set `Max per row` to tell grafana how many panels per row you want at most. It defaults to *4* if you don't set anything.

By choosing `vertical` the panels will be arranged from top to bottom in a column. The width of the repeated panels will be the same as of the first panel (the original template) being repeated.

Only make changes to the first panel (the original template). To have the changes take effect on all panels you need to trigger a dynamic dashboard re-build.
You can do this by either changing the variable value (that is the basis for the repeat) or reload the dashboard.

> **Note:** Repeating panels require variables to have one or more items selected; you cannot repeat a panel zero times to hide it.

## Repeating rows

As seen above with the panels you can also repeat rows if you have variables set with  `Multi-value` or
`Include all value` selection option.

To enable this feature you need to first add a new *Row* using the *Add Panel* menu. Then by hovering the row title and
clicking on the cog button, you will access the `Row Options` configuration panel. You can then select the variable
you want to repeat the row for.

It may be a good idea to use a variable in the row title as well.
