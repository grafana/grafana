---
description: Feature and improvement highlights for Grafana Cloud
keywords:
  - grafana
  - new
  - documentation
  - cloud
  - release notes
labels:
  products:
    - cloud
title: What's new in Grafana Cloud
weight: -37
---

# What’s new in Grafana Cloud

Welcome to Grafana Cloud! Read on to learn about the newest changes to Grafana Cloud.

## Query-type template variables for Tempo data source

<!-- Fabrizio Casati -->
<!-- OSS, Enterprise -->

_Generally available in Grafana Cloud_

The Tempo data source now supports query-type template variables. With this update, you can create variables for which the values are a list of attribute names or attribute values seen on spans received by Tempo.

To learn more, refer to the following video demo, as well as the [Grafana Variables documentation](/docs/grafana/latest/dashboards/variables/).

{{< video-embed src="/media/docs/tempo/screen-recording-grafana-10.2-tempo-query-type-template-variables.mp4" >}}
