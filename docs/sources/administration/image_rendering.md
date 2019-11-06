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

Grafana supports rendering of panels and dashboards as PNG-images.

When an image is being rendered the PNG-image is temporary written to the filesystem, i.e. a sub-directory of Grafana's [data](/installation/configuration/#data) directory named `png`.

A background job runs each 10 minutes and will remove temporary images. You can configure how long time an image should be stored before being removed by configuring the [temp-data-lifetime](/installation/configuration/#temp-data-lifetime) setting.

## Rendering methods

### PhantomJS

> PhantomJS is deprecated since Grafana v6.4 and will be removed in a future release. Please migrate to Grafana image renderer plugin or remote rendering service.

[PhantomJS](https://phantomjs.org/) have been the only supported and default image renderer since Grafana v2.x and is shipped with Grafana.

Please note that for macOS and Windows, you will need to ensure that a phantomjs binary is available under tools/phantomjs/phantomjs. For Linux, a phantomjs binary is included - however, you should ensure that any required libraries, e.g. libfontconfig1, are available.

### Grafana image renderer plugin

> This plugin currently does not work if it is installed in Grafana docker image.

The [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) is a plugin that runs on the backend and handles rendering panels and dashboards as PNG-images using headless chrome.

You can install it using grafana-cli:

```bash
grafana-cli plugins install grafana-image-renderer
```

For further information and instructions refer to the [plugin details](https://grafana.com/grafana/plugins/grafana-image-renderer).

### Remote rendering service

The [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) can also be run as a remote HTTP rendering service. In this setup Grafana will render an image by making a HTTP request to the remote rendering service, which in turn render the image and returns it back in the HTTP response to Grafana.

You can run the remote HTTP rendering service using Docker or as a standalone Node.js application.

**Using Docker:**

The following example describes how to run Grafana and the remote HTTP rendering service in two separate docker containers using Docker Compose.

Create a `docker-compose.yml` with the following content.

```yaml
version: '2'

services:
  grafana:
    image: grafana/grafana:master
    ports:
     - "3000:3000"
    environment:
      GF_RENDERING_SERVER_URL: http://renderer:8081/render
      GF_RENDERING_CALLBACK_URL: http://grafana:3000/
      GF_LOG_FILTERS: rendering:debug
  renderer:
    image: grafana/grafana-image-renderer:latest
    ports:
      - 8081
```

and finally run:

```bash
docker-compose up
```

**Running as standalone Node.js application:**

The following example describes how to build and run the remote HTTP rendering service as a standalone node.js application and configure Grafana appropriately.

1. Git clone the [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) repository.
2. Install dependencies and build:

```bash
yarn install --pure-lockfile
yarn run build
```
3. Run the server

```bash
node build/app.js server --port=8081
```
3. Update Grafana configuration:

```
[rendering]
server_url = http://localhost:8081/render
callback_url = http://localhost:3000/
```
4. Restart Grafana

## Alerting and render limits

Alert notifications can include images, but rendering many images at the same time can overload the server where the renderer is running. For instructions of how to configure this, see [concurrent_render_limit](/installation/configuration/#concurrent-render-limit).

