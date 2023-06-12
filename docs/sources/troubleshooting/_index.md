---
aliases:
  - troubleshoot-dashboards/
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

For more information, refer to [Enable debug logging in Grafana CLI]({{< relref "../cli/#enable-debug-logging" >}}) and the [log section in Configuration]({{< relref "../setup-grafana/configure-grafana/#log" >}}).

## Troubleshoot with Dashboards Panels

If you have an issue with your Dashboard panel, you can send us debug information. For more information, refer to [Send a panel to Grafana Labs support]({{< relref "./send-panel-to-grafana-support/" >}}).

## Troubleshoot with support bundles

If you have an issue with your Grafana instance, you can generate an archive containing information concerning the state and the configuration of the instance.

To send us a bundle for advanced support, refer to [Send a support bundle to Grafana Labs support]({{< relref "./support-bundles/" >}}).

## Troubleshoot transformations

Order of transformations matters. If the final data output from multiple transformations looks wrong, try changing the transformation order. Each transformation transforms data returned by the previous transformation, not the original raw data.

For more information, refer to [Debug a transformation]({{< relref "../panels-visualizations/query-transform-data/transform-data/#debug-a-transformation" >}}).

## Text missing with server-side image rendering (RPM-based Linux)

Server-side image (png) rendering is a feature that is optional but very useful when sharing visualizations, for example in alert notifications.

If the image is missing text, then make sure you have font packages installed.

```bash
sudo yum install fontconfig
sudo yum install freetype*
sudo yum install urw-fonts
```

## More help

Check out the [Grafana Community](https://community.grafana.com/) for more troubleshooting help (you must be logged in to post or comment).
