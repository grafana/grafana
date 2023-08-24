+++
title = "Sort dashboards by using insights data"
description = "Sort dashboards by using insights data"
keywords = ["grafana", "search", "sort", "enterprise"]
aliases = ["/docs/grafana/v7.4/enterprise/usage-insights/improved-search.md"]
weight = 400
+++

# Sort dashboards by using insights data

> **Note:** Available in Grafana Enterprise v7.0+.

In the search view, you can sort dashboards by using insights data. Doing so helps you find unused or broken dashboards or discover those that are most viewed.

There are several sort options:
- Errors total
- Errors 30 days
- Views total
- Views 30 days

`Errors 30 days` and `Views 30 days` are based on a calculated sorting index that weighs errors and views that happened within the past day more heavily than those that happened over the past 30 days.

{{< figure src="/static/img/docs/enterprise/improved_search.png" max-width="650px" class="docs-image--no-shadow" >}}

