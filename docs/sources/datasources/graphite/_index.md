---
aliases:
  - ../data-sources/graphite/
  - ../features/datasources/graphite/
description: Introduction to the Graphite data source in Grafana.
keywords:
  - grafana
  - graphite
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Graphite
title: Graphite data source
weight: 600
---

# Graphite data source

Grafana includes built-in support for Graphite.
This topic explains options, variables, querying, and other features specific to the Graphite data source, which include its feature-rich query editor.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

Once you've added the Graphite data source, you can [configure it](#configure-the-data-source) so that your Grafana instance's users can create queries in its [query editor](query-editor/) when they [build dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/) and use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/).

{{< docs/play title="Graphite: Sample Website Dashboard" url="https://play.grafana.org/d/000000003/" >}}

Grafana exposes metrics for Graphite on the `/metrics` endpoint.
For detailed instructions, refer to [Internal Grafana metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/).

## Get Grafana metrics into Graphite

Grafana exposes metrics for Graphite on the `/metrics` endpoint.
Refer to [Internal Grafana metrics](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/) for more information.

## Graphite and Loki integration

When you change the data source selection in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/), Graphite queries are converted to Loki queries.
Grafana extracts Loki label names and values from the Graphite queries according to mappings provided in the Graphite data source configuration. Grafana automatically transforms queries using tags with `seriesByTags()` without requiring additional setup.

## Get the most out of the data source

After installing and configuring the Graphite data source you can:

- Create a wide variety of [visualizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/)
- Configure and use [templates and variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/)
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/)
- Add [annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/annotate-visualizations/)
- Set up [alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/)
- [Troubleshoot](troubleshooting/) common issues with the Graphite data source
