---
title: Panel filtering
---

In table visualizations, you can apply ad hoc filters from the visualization with one click.
To quickly ad hoc filter variables, follow these steps:

1. Hover your cursor over the cell with the value you want to filter for to display the filter icons. In this example, the cell value is `ConfigMap Updated`, which is in the `alertname` column:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-ad-hoc-filter-icon-v12.png" max-width="750px" alt="Table with ad hoc filter icon displayed on a cell" >}}

1. Click the add filter icon.

   The variable pair `alertname = ConfigMap Updated` is added to the ad hoc filter and all panels using the same data source that include that variable value are filtered by that value:

   {{< figure src="/media/docs/grafana/panels-visualizations/screenshot-ad-hoc-filter-applied-v12.2.png" max-width="750px" alt="Two tables, filtered" >}}

If one of the panels in the dashboard using that data source doesn't include that variable value, the panel won't return any data. In this example, the variable pair `_name_ = ALERTS` has been added to the ad hoc filter so one of the tables doesn't return any results:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-ad-hoc-filter-no-data-v12.2.png" max-width="750px" alt="Two tables, one filtered and one returning no results" >}}

### Filter between dashboards

You can also filter panels on another dashboard using data links, by including a variable in the link:

```
https://play.grafana.org/d/HYaGDGIMk/templating-global-variables-and-interpolation?orgId=1&from=now-6h&to=now&timezone=utc&var-Server=CCC&var-MyCustomDashboardVariable=Hello%20World%21
```

In the preceding example, the variables and values are `var-Server=CCC` and `var-MyCustomDashboardVariable=Hello%20World%21`.
When someone clicks the link, they're taken to a version of the dashboard with those variables already applied.