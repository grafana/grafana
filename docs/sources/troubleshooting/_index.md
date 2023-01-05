---
description: Guide to troubleshooting Grafana problems
keywords:
  - grafana
  - troubleshooting
  - documentation
  - guide
title: Troubleshooting
weight: 180
---

# Troubleshooting

This page lists some tools and advice to help troubleshoot common Grafana issues.

## Troubleshoot with logs

If you encounter an error or problem, then you can check the Grafana server log. Usually located at `/var/log/grafana/grafana.log` on Unix systems or in `<grafana_install_dir>/data/log` on other platforms and manual installations.

You can enable more logging by changing log level in the Grafana configuration file.

For more information, refer to [Enable debug logging in Grafana CLI]({{< relref "../administration/cli.md#enable-debug-logging" >}}) and the [log section in Configuration]({{< relref "../administration/configuration.md#log" >}}).

## Troubleshoot transformations

Order of transformations matters. If the final data output from multiple transformations looks wrong, try changing the transformation order. Each transformation transforms data returned by the previous transformation, not the original raw data.

For more information, refer to [Debug a transformation]({{< relref "../panels/transform-data/debug-transformation.md" >}}).

## Text missing with server-side image rendering (RPM-based Linux)

Server-side image (png) rendering is a feature that is optional but very useful when sharing visualizations, for example in alert notifications.

If the image is missing text, then make sure you have font packages installed.

```bash
sudo yum install fontconfig
sudo yum install freetype*
sudo yum install urw-fonts
```

## FAQs

Check out the [FAQ section](https://community.grafana.com/c/howto/faq) on the Grafana Community page for answers to frequently
asked questions.
