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

## Requirements

Rendering images may require quite a lot of memory, mainly because there are "browser instances" started in the
background responsible for the actual rendering. Further, if multiple images are being rendered in parallel it most
certainly has a bigger memory footprint. Minimum free memory recommendation is 1GB.

Depending on [rendering method](#rendering-methods) you would need that memory available in the system where the
rendering process is running. For [Grafana Image renderer plugin](#grafana-image-renderer-plugin) and [PhantomJS](#phantomjs)
it's the system which Grafana is installed on. For [Remote rendering service](#remote-rendering-service) it is the system where
that's installed.

## Rendering methods

### Grafana image renderer plugin

> This plugin currently does not work if it is installed in the Grafana docker image. See [Install in Grafana docker image](#install-in-grafana-docker-image).

The [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) is a plugin that runs on the backend and handles rendering panels and dashboards as PNG-images using headless chrome.

You can install it using grafana-cli:

```bash
grafana-cli plugins install grafana-image-renderer
```

For further information and instructions refer to [troubleshooting](#troubleshooting) and the [plugin details](https://grafana.com/grafana/plugins/grafana-image-renderer).

#### Install in Grafana docker image

This plugin is not compatible with the current Grafana Docker image without installing further system-level dependencies. We recommend setting up another Docker container for rendering and using remote rendering, see [Remote rendering service](#remote-rendering-service) for reference.

If you still want to install the plugin in the Grafana docker image we provide instructions for how to build a custom Grafana image, see [Installing using Docker](/installation/docker/#custom-image-with-grafana-image-renderer-plugin-pre-installed).

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

For further information and instructions refer to [troubleshooting](#troubleshooting) and the [plugin details](https://grafana.com/grafana/plugins/grafana-image-renderer).

### PhantomJS

> PhantomJS is deprecated since Grafana v6.4 and will be removed in a future release. Please migrate to Grafana image renderer plugin or remote rendering service.

[PhantomJS](https://phantomjs.org/) have been the only supported and default image renderer since Grafana v2.x and is shipped with Grafana.

PhantomJS binaries are included for Linux (x64), Windows (x64) and Darwin (x64). For Linux you should ensure that any required libraries, e.g. libfontconfig1, are available.

Please note that PhantomJS binaries are not included for ARM. To support this you will need to ensure that a phantomjs binary is available under tools/phantomjs/phantomjs.

## Alerting and render limits

Alert notifications can include images, but rendering many images at the same time can overload the server where the renderer is running. For instructions of how to configure this, see [concurrent_render_limit](/installation/configuration/#concurrent-render-limit).

## Troubleshooting

Enable debug log messages for rendering in the Grafana configuration file and inspect the Grafana server log.

```bash
[log]
filters = rendering:debug
```

### Grafana image renderer plugin and remote rendering service

The plugin and rendering service uses [Chromium browser](https://www.chromium.org/) which depends on certain libraries.
If you don't have all of those libraries installed in your system you may encounter errors when trying to render an image, e.g.

```bash
Rendering failed: Error: Failed to launch chrome!/var/lib/grafana/plugins/grafana-image-renderer/chrome-linux/chrome:
error while loading shared libraries: libX11.so.6: cannot open shared object file: No such file or directory\n\n\nTROUBLESHOOTING: https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md
```

In general you can use the [`ldd`](https://en.wikipedia.org/wiki/Ldd_(Unix)) utility to figure out what shared libraries
are missing/not installed in your system:

```bash
$ cd <grafana-image-render plugin directiry>
$ ldd chrome-linux/chrome
        linux-vdso.so.1 (0x00007fff1bf65000)
        libdl.so.2 => /lib/x86_64-linux-gnu/libdl.so.2 (0x00007f2047945000)
        libpthread.so.0 => /lib/x86_64-linux-gnu/libpthread.so.0 (0x00007f2047924000)
        librt.so.1 => /lib/x86_64-linux-gnu/librt.so.1 (0x00007f204791a000)
        libX11.so.6 => not found
        libX11-xcb.so.1 => not found
        libxcb.so.1 => not found
        libXcomposite.so.1 => not found
        ...
```

**Ubuntu:**

On Ubuntu 18.10 the following dependencies have been confirmed as needed for the image rendering to function.

```bash
libx11-6 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrender1 libxtst6 libglib2.0-0 libnss3 libcups2  libdbus-1-3 libxss1 libxrandr2 libgtk-3-0 libgtk-3-0 libasound2
```

**Centos:**

On a minimal Centos install the following dependencies have been confirmed as needed for the image rendering to function.

```bash
libXcomposite libXdamage libXtst cups libXScrnSaver pango atk adwaita-cursor-theme adwaita-icon-theme at at-spi2-atk at-spi2-core cairo-gobject colord-libs dconf desktop-file-utils ed emacs-filesystem gdk-pixbuf2 glib-networking gnutls gsettings-desktop-schemas gtk-update-icon-cache gtk3 hicolor-icon-theme jasper-libs json-glib libappindicator-gtk3 libdbusmenu libdbusmenu-gtk3 libepoxy liberation-fonts liberation-narrow-fonts liberation-sans-fonts liberation-serif-fonts libgusb libindicator-gtk3 libmodman libproxy libsoup libwayland-cursor libwayland-egl libxkbcommon m4 mailx nettle patch psmisc redhat-lsb-core redhat-lsb-submod-security rest spax time trousers xdg-utils xkeyboard-config
```

#### Using custom Chrome/Chromium

As a last resort, if you already have [Chrome](https://www.google.com/chrome/) or [Chromium](https://www.chromium.org/)
installed on your system you can configure [Grafana Image renderer plugin](#grafana-image-renderer-plugin) to use this
instead of the pre-packaged version of Chromium.

> Please note that this is not recommended since you may encounter problems if the installed version of Chrome/Chromium is not
> is compatible with the [Grafana Image renderer plugin](#grafana-image-renderer-plugin).

To override the path to the Chrome/Chromium executable you can set an environment variable and make sure that
it's available for the Grafana process, e.g.

```bash
export GF_RENDERER_PLUGIN_CHROME_BIN="/usr/bin/chromium-browser"
```
