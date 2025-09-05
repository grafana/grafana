---
title: Panel filtering
---

In table visualizations, you can apply ad hoc filters from the visualization with one click.
To quickly ad hoc filter variables, follow these steps:

1. Hover your cursor over the cell with the value you want to filter for to display the filter icons. In this example, the cell value is `ConfigMap Updated`, which is in the `alertname` column:

   {{< figure src="screenshot-ah-table-filter-icon-ph.png" max-width="750px" alt="TBD" >}}

1. Click the add filter icon.

   The variable pair `alertname = ConfigMap Updated` is added to the ad hoc filter and all panels using the same data source that include that variable value are filtered by that value:

   {{< figure src="screenshot-ah-table-filtered-ph.png" max-width="750px" alt="TBD" >}}

If one of the panels in the dashboard using that data source doesn't include that variable value, the panel won't return any data. In this example, the variable pair `name = ALERTS` has been added to the ad hoc filter so one of the tables doesn't return any results:

{{< figure src="screenshot-ah-table-filter-no-data-ph.png" max-width="750px" alt="TBD" >}}