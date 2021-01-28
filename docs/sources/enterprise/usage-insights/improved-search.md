+++
title = "Sort dashboards using insights data"
description = "Sort dashboards using insights data"
keywords = ["grafana", "search", "sort", "enterprise"]
aliases = ["/docs/grafana/latest/enterprise/usage-insights/improved-search.md"]
weight = 400
+++

# Sort dashboards using insights data

> **Note:** Available in Grafana Enterprise v7.0+.

In the search view, you can sort dashboards using these insights data. It helps you find unused or broken dashboards or discover most viewed ones.

The available sort options are:
- Errors total
- Errors 30 days
- Views total
- Views 30 days

`Errors 30 days` and `Views 30 days` are based on a calculated sorting index that puts more weight into errors and views that happened on the past day than on the ones that happened on the past 30 days.  

{{< docs-imagebox img="/img/docs/enterprise/improved_search.png" max-width="650px" class="docs-image--no-shadow" >}}


