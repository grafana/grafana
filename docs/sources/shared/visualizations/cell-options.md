---
title: Cell options
---

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Wrap text | Toggle the **Wrap text** switch to wrap text in the cell that contains the longest content in your table. To wrap the text _in a specific column only_, use a **Fields with name** [field override](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/), select the **Cell options > Cell type** override property, and toggle on the **Wrap text** switch. |
| Cell value inspect | <p>Enables value inspection from table cells. When the switch is toggled on, clicking the inspect icon in a cell opens the **Inspect value** drawer which contains two tabs: **Plain text** and **Code editor**.</p><p>Grafana attempts to automatically detect the type of data in the cell and opens the drawer with the associated tab showing. However, you can switch back and forth between tabs.</p> |
| Tooltip from field | Toggle on the **Tooltip from field** switch to use the values from another field (or column) in a tooltip. For more information, refer to [Tooltip from field](#tooltip-from-field). |
<!-- prettier-ignore-end -->
