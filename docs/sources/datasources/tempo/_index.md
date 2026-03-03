---
aliases:
  - ../data-sources/tempo/
  - ../features/datasources/tempo/
description: Guide for using Tempo in Grafana
keywords:
  - grafana
  - tempo
  - guide
  - tracing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Tempo
title: Tempo data source
weight: 1400
---

# Tempo data source

Grafana ships with built-in support for [Tempo](https://grafana.com/docs/tempo/<TEMPO_VERSION>/), a high-volume, minimal-dependency trace storage, open source tracing solution from Grafana Labs.

To learn more about traces, refer to [Introduction to tracing](https://grafana.com/docs/tempo/<TEMPO_VERSION>/introduction/).

To use traces, you need you have an application or service that is instrumented to emit traces.
Refer to the [Instrument for tracing](https://grafana.com/docs/tempo/<TEMPO_VERSION>/getting-started/instrumentation/) for more information.

## Add a data source

For instructions on how to add a data source to Grafana, refer to the [administration documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#provision-the-data-source) with Grafana's provisioning system.

This video explains how to add data sources, including Loki, Tempo, and Mimir, to Grafana and Grafana Cloud. Tempo data source set up starts at 4:58 in the video.

{{< youtube id="cqHO0oYW6Ic" start="298" >}}

## Learn more

After you've added the data source, you can [configure it](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/) so that your Grafana instance's users can create queries in its [query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/) when they [build dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/) and use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/).

{{< section withDescriptions="true">}}
