---
aliases:
  - ../administration/image_rendering/
  - ../image-rendering/
description: Image rendering
keywords:
  - grafana
  - image
  - rendering
labels:
  products:
    - enterprise
    - oss
title: Set up image rendering
weight: 1000
---

# Set up image rendering

Grafana maintains a separate service for rendering images and PDFs of dashboards and panels, called the [Grafana Image Renderer](https://github.com/grafana/grafana-image-renderer).
This service powers panel images in alert notifications, [PDF export](../../dashboards/create-reports/#export-dashboard-as-pdf), and [Reporting](../../dashboards/create-reports/).
Please note that PDF exports and Reporting are available only in [Grafana Enterprise](../../introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud/).

You can also render a PNG by hovering over the panel to display the actions menu in the top-right corner, and then clicking **Share > Share link**. The **Render image** option is displayed in the link settings.

## Alerting and render limits

Alert notifications can include images, but rendering many images at the same time can overload the server where the renderer is running. For instructions of how to configure this, see [max_concurrent_screenshots](../configure-grafana/#max_concurrent_screenshots).
Alternatively, you can configure the service to scale according to requests, if you run on Kubernetes or other setups; [Grafana Cloud](https://grafana.com/products/cloud/) uses this approach to avoid impact on you.

## Deploy the service

To deploy the service, please refer to the [Grafana Image Renderer deployment instructions](https://github.com/grafana/grafana-image-renderer/blob/master/README.md#installation).
The configuration options are also described on the same page.

You will not find any more configuration information on this page; please refer to the service's own documentation for
details. We've done this to ensure that you get the best information, as the service is actively developed and
improved over time.
