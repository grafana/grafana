---
title: Panel filtering
---

<!-- use heading: Panel filtering with ad hoc filters -->

<!-- vale Grafana.WordList = NO -->
<!-- vale Grafana.Spelling = NO -->

In table and bar chart visualizations, you can apply ad hoc filters from the visualization with one click.
To quickly ad hoc filter variables, follow these steps:

1. Hover your cursor over the cell with the value you want to filter for to display the filter icons. In this example, the cell value is `ConfigMap Updated`, which is in the `alertname` column:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-adhoc-filter-icon-v12.2.png" max-width="750px" alt="Table and bar chart with ad hoc filter icon displayed on a table cell" >}}

1. Click the add filter icon.

   The variable pair `alertname = ConfigMap Updated` is added to the ad hoc filter and all panels using the same data source that include that variable value are filtered by that value:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-adhoc-filter-applied-v12.2.png" max-width="750px" alt="Table and bar chart, filtered" >}}

If one of the panels in the dashboard using that data source doesn't include that variable value, the panel won't return any data. In this example, the variable pair `_name_ = ALERTS` has been added to the ad hoc filter so one of the tables doesn't return any results:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-adhoc-filter-no-data-v12.2.png" max-width="750px" alt="Table, filtered and bar chart returning no results" >}}

<!-- vale Grafana.Spelling = YES -->
<!-- vale Grafana.WordList = YES -->
