+++
title = "Image Rendering"
description = ""
keywords = ["grafana", "image", "rendering", "phantomjs"]
type = "docs"
aliases = ["/installation/image-rendering"]
[menu.docs]
parent = "admin"
weight = 8
+++

# Image Rendering

Grafana supports rendering of panels and dasnhboards as PNG-images.

When an image is being rendered the PNG-image is temporary written to the filesystem, i.e. a sub-directory of Grafana's [data](/installation/configuration/#data) directory named `png`.

A background job runs each 10 minutes and will remove temporary images. You can configure how long time an image should be stored before being removed by configuring the [temp-data-lifetime](/installation/configuration/#temp-data-lifetime) setting.

## Rendering methods

### PhantomJS

> PhantomJS is deprecated since Grafana v6.4 and will be removed in a future release. Please migrate to Grafana image renderer plugin or remote rendering service.

[PhantomJS](https://phantomjs.org/) have been the only supported and default image renderer since Grafana v2.x and is shipped with Grafana.

Please note that for OSX and Windows, you will need to ensure that a phantomjs binary is available under tools/phantomjs/phantomjs. For Linux, a phantomjs binary is included - however, you should ensure that any required libraries, e.g. libfontconfig1, are available.

### Grafana image renderer plugin

The [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) is a plugin that runs on the backend and handles rendering panels and dashboards as PNG-images using headless chrome.

You can install it using grafana-cli:

```bash
grafana-cli plugins install grafana-image-renderer
```

For further information and instructions refer to the [plugin details](https://grafana.com/grafana/plugins/grafana-image-renderer).

### Remote rendering service

The [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) can also be run as a remote HTTP rendering service. In this setup Grafana will render an image by making a HTTP request to the remote rendering service, which in turn render the image and returns it back in the HTTP response to Grafana.

To configure Grafana to use a remote HTTP rendering service, please refer to [rendering](/installation/configuration/#rendering) configuration section.

## Alerting and render limits

Alert notifications can include images, but rendering many images at the same time can overload the server where the renderer is running. For instructions of how to configure this, see [concurrent_render_limit](/installation/configuration/#concurrent-render-limit).

