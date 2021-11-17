+++
title = "Configure repeating panels"
weight = 1
+++

# Configure repeating panels

If you have a variable with `Multi-value` or `Include all value` options enabled you can choose one panel and have Grafana repeat that panel
for every selected value. You find the _Repeat_ feature under the _General tab_ in panel edit mode.

The `direction` controls how the panels will be arranged.

By choosing `horizontal` the panels will be arranged side-by-side. Grafana will automatically adjust the width
of each repeated panel so that the whole row is filled. Currently, you cannot mix other panels on a row with a repeated
panel.

Set `Max per row` to tell grafana how many panels per row you want at most. It defaults to _4_ if you don't set anything.

By choosing `vertical` the panels will be arranged from top to bottom in a column. The width of the repeated panels will be the same as of the first panel (the original template) being repeated.

Only make changes to the first panel (the original template). To have the changes take effect on all panels you need to trigger a dynamic dashboard re-build.
You can do this by either changing the variable value (that is the basis for the repeat) or reload the dashboard.

> **Note:** Repeating panels require variables to have one or more items selected; you cannot repeat a panel zero times to hide it.
