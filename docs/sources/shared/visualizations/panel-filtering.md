---
title: Panel filtering
---

<!-- use heading: Panel filtering with ad hoc filters -->

<!-- vale Grafana.WordList = NO -->
<!-- vale Grafana.Spelling = NO -->

In table visualizations, you can apply ad hoc filters from the visualization with one click.
To quickly filter the dashboard data, follow these steps:

1. Hover your cursor over the cell with the value you want to filter for to display the filter icons. In this example, the cell value is `ConfigMap Updated`, which is in the `alertname` column:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-ad-hoc-filter-icon-v12.png" max-width="750px" alt="Table with ad hoc filter icon displayed on a cell" >}}

1. Click the add filter icon.

   The variable pair `alertname = ConfigMap Updated` is added to the ad hoc filter and all panels using the same data source are filtered by that value:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-ad-hoc-filter-applied-v12.2.png" max-width="750px" alt="Two tables, filtered" >}}

If one of the panels in the dashboard using that data source doesn't include that variable value, the panel won't return any data. In this example, the variable pair `_name_ = ALERTS` has been added to the ad hoc filter so one of the tables doesn't return any results:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-ad-hoc-filter-no-data-v12.2.png" max-width="750px" alt="Two tables, one filtered and one returning no results" >}}

<!-- vale Grafana.Spelling = YES -->
<!-- vale Grafana.WordList = YES -->
