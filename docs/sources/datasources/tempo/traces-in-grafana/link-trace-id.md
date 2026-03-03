---
description: Link to trace IDs from logs and metrics
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
menuTitle: Link to a trace ID
title: Link to a trace ID
weight: 800
aliases:
  - ../link-trace-id/ # /docs/grafana/latest/datasources/tempo/link-trace-id/
---

# Link to a trace ID

You can link to Tempo traces from logs or metrics.

## Link to a trace ID from logs

You can link to Tempo traces from logs in Loki, Elasticsearch, Splunk, and other logs data sources by configuring an internal link.

To configure this feature, refer to the [Derived fields](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure-loki-data-source/#derived-fields) section of the Loki data source docs or the [Data links](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/elasticsearch/configure/#data-links) section of the Elasticsearch or Splunk data source docs.

## Link to a trace ID from metrics

You can link to Tempo traces from metrics in Prometheus data sources by configuring an exemplar.

To configure this feature, refer to the [Exemplars](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/) documentation.
