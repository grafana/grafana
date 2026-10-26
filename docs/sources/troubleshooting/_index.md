---
aliases:
  - troubleshoot-dashboards/
description: Guide to troubleshooting Grafana problems
keywords:
  - grafana
  - troubleshooting
  - documentation
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Troubleshooting
cards:
  items:
    - title: Generate diagnostic bundle
      height: 24
      href: ./generate-diagnostic-bundle/
      description: Generate a data source diagnostic bundle and send it to Grafana Labs Support for troubleshooting.
    - title: HAR captures
      height: 24
      href: ./har-captures/
      description: Generate a HAR capture to send to Grafana Labs support for troubleshooting.
    - title: Send panel to Grafana Support
      height: 24
      href: ./send-panel-to-grafana-support/
      description: Send a panel to Grafana Labs support for troubleshooting.
weight: 700
---

# Troubleshooting

This page lists some tools and advice to help troubleshoot common Grafana issues.

{{< card-grid key="cards" type="simple" >}}

## Troubleshoot transformations

The order of transformations matters. If the final data output from multiple transformations looks wrong, try changing the transformation order. Each transformation transforms data returned by the previous transformation, not the original raw data.

For more information, refer to [Debug a transformation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/transform-data/#debug-a-transformation).

## Troubleshoot with logs

If you encounter an error or problem, then you can check the Grafana server log. Usually located at `/var/log/grafana/grafana.log` on Unix systems or in `<grafana_install_dir>/data/log` on other platforms and manual installations.

You can enable more logging by changing log level in the Grafana configuration file. For more information, refer to [the `gcx` Grafana CLI](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/gcx/) and the [log section in Configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#log).

## Text is missing when rendering server-side images (RPM-based Linux)

Server-side image rendering is an optional feature that helps you to share visualizations, for example in alert notifications.

If the image is missing text, make sure you have font packages installed:

```bash
sudo yum install fontconfig
sudo yum install freetype*
sudo yum install urw-fonts
```

## Troubleshoot backend performance

If you're experiencing backend performance problems, such as high memory or CPU usage, please refer to [Configure profiling and tracing to troubleshoot Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/configure-tracing/).

## More help

{{< docs/shared lookup="communicate.md" source="grafana" version="<GRAFANA_VERSION>" >}}
