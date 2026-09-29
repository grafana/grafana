---
title: Panel options
comments: |
  This file is used in all visualizations pages
---

In the **Panel options** section of the panel editor pane, set options like the panel title and show/hide rules.
To learn more, refer to [Configure panel options](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/configure-panel-options/).

<!-- prettier-ignore-start -->

| Option                 | Description                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Title                  | Text entered in this field appears at the top of your panel in the panel editor and in the dashboard. You can use [variables you have defined](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/) or [global variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#global-variables). |
| Description            | Add a description to a panel to share with users any important information about it, such as its purpose. Text entered in this field appears in a tooltip in the upper-left corner of the panel. Conversely, toggle on the **Use as subtitle** switch to display the description just below the panel title instead. You can use [variables you have defined](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/) or dashboard-scoped [global variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/variables/add-template-variables/#global-variables) (such as `$__from`, `$__to`, `$__dashboard`, `$__org`, and `$__user`). Query-scoped global variables (such as `$__interval` and `$__interval_ms`) are not available in this field. |
| Transparent background | Toggle this switch on and off to control whether or not the panel has the same background color as the dashboard. | 
| Panel links | Add [links to the panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/manage-dashboard-links/#panel-links) to create shortcuts to other dashboards, panels, and external websites. Access panel links by clicking the icon next to the panel title. |
| Repeat options         | Set whether to repeat the panel for each value in the selected variable. |
| Show/hide rules        | Set whether to show or hide panels based on various rules. |

<!-- prettier-ignore-end -->
