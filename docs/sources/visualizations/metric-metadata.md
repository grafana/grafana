+++
title = "Prometheus with metric metadata in Grafana’s Explore view"
description = "Prometheus with metric metadata"
keywords = ["grafana", "docs", "prometheus", "metric", "metadata"]
weight = 605
+++

This section provides information on Grafana's feature to easily find metric metadata when using Prometheus. Poor naming conventions often make data difficult to understand, so this feature simplifies Prometheus for the user.

[comment]: <> (Intro here)

# Use Prometheus with metric metadata in Grafana's Explorer view

Prometheus and Grafana are a favorable pairing at Grafana Labs. We are aware of situations where data can be confusing to read, especially when [naming conventions](https://prometheus.io/docs/practices/naming/#metric-names) are unclear or not followed. We believe in making it easy to understand metrics, so we included features that provide clarity to our users.

Prometheus v2.15+ and Grafana v6.6+ offer metric metadata directly in Grafana’s Explore view. [Cortex v1.1+](https://grafana.com/blog/2020/05/21/cortex-v1.1-released-with-improved-reliability-and-performance/) also supports this when you pair it with the [Grafana Agent](https://grafana.com/docs/grafana-cloud/agent/).

[Gauges(https://prometheus.io/docs/concepts/metric_types/#gauge) with highly monotonic increases could pose as [Counters](https://prometheus.io/docs/concepts/metric_types/#counter), making it difficult to tell the difference between these metrics since they are named so similarly.

Although the ability to find metadata from Prometheus has always been there via the [Scrape Targets Metadata API endpoint](https://prometheus.io/docs/prometheus/latest/querying/api/#querying-target-metadata), it generally gives excessive information, making information difficult to find.

[comment]: <> (How relevant is mentioning scrape targets?)

"making the information harder to find, as it is per scrape target. The truth is, more often than not, our users don’t care about which scrape target exposes the metadata as much they care about what the metadata is. Scrape target information will typically be exposed as a label anyway."

To resolve this issue, we have implemented a feature where you type in the name of a metric, and the AutoComplete panel shows the metric metadata. Metric names include:

- **Type.** No more guessing on when you should apply `rate` to this function
- **Help.** No more ambiguity on what this metric does
- **Unit.** No more `_seconds` suffixes
