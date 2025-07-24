---
title: Cell options
---

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Wrap text | <p>Toggle the **Wrap text** switch to wrap text in the cell that contains the longest content in your table. To wrap the text _in a specific column only_, use a **Fields with name** [field override](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-overrides/), select the **Cell options > Cell type** override property, and toggle on the **Wrap text** switch.</p><p>Text wrapping is in [public preview](https://grafana.com/docs/release-life-cycle/#public-preview), however, it’s available to use by default.</p> |
| Cell value inspect | <p>Enables value inspection from table cells. When the switch is toggled on, clicking the inspect icon in a cell opens the **Inspect value** drawer which contains two tabs: **Plain text** and **Code editor**.</p><p>Grafana attempts to automatically detect the type of data in the cell and opens the drawer with the associated tab showing. However, you can switch back and forth between tabs.</p> |
<!-- prettier-ignore-end -->
