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
refs:
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  node-graph:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/visualizations/panels-visualizations/visualizations/node-graph/
  configure-tempo-data-source:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#provision-the-data-source
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/tempo/configure-tempo-data-source/
  exemplars:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
  variable-syntax:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/
  explore-trace-integration:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/trace-integration/
  configure-grafana-feature-toggles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# Tempo data source

Grafana ships with built-in support for [Tempo](https://grafana.com/docs/tempo/latest/), a high-volume, minimal-dependency trace storage, open source tracing solution from Grafana Labs. This topic explains configuration and queries specific to the Tempo data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.
Administrators can also [configure the data source via YAML](ref:configure-tempo-data-source) with Grafana's provisioning system.

This video explains how to add data sources, including Loki, Tempo, and Mimir, to Grafana and Grafana Cloud. Tempo data source set up starts at 4:58 in the video.

{{< youtube id="cqHO0oYW6Ic" start="298" >}}

Once you've added the data source, you can [configure it](configure-tempo-data-source/) so that your Grafana instance's users can create queries in its [query editor](query-editor/) when they [build dashboards](ref:build-dashboards) and use [Explore](ref:explore).

{{< section withDescriptions="true">}}
