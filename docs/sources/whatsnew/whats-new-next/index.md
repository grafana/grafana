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

## Support query-type template variables for Tempo data source

<!-- Fabrizio Casati -->
<!-- OSS, Enterprise -->

_Generally available in Grafana Cloud_

The Tempo data source now supports query-type template variables. With this, you can now create variables whose values are a list of attribute names or attribute values seen on spans received by Tempo.

To learn more, refer to the video demo below as well as to the [Variables page](https://grafana.com/docs/grafana/latest/dashboards/variables/) in the Grafana documentation.

{{< video-embed src="/media/docs/tempo/screen-recording-grafana-10.2-tempo-query-type-template-variables.mp4" >}}
