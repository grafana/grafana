+++
title = "Image rendering"
description = ""
keywords = ["grafana", "image", "rendering", "plugin"]
type = "docs"
[menu.docs]
parent = "features"
weight = 8
+++

# Image rendering

Grafana supports automatic rendering of panels and dashboards as PNG images. This allows Grafana to automatically generate images of your panels to include in [alert notifications]({{< relref "../alerting/notifications.md" >}}).

While an image is being rendered, the PNG image is temporarily written to the file system. When the image is rendered, the PNG image is temporarily written to the `png` folder in the Grafana `data` folder.

A background job runs every 10 minutes and removes temporary images. You can configure how long an image should be stored before being removed by configuring the [temp-data-lifetime]({{< relref "../installation/configuration/#temp-data-lifetime" >}}) setting.

You can also render a PNG by clicking the dropdown arrow next to a panel title, then clicking **Share > Direct link rendered image**.

## Memory requirements

Minimum free memory recommendation is 16GB on the system doing the rendering.

Rendering images can require a lot of memory, mainly because Grafana creates browser instances in the background for the actual rendering. If multiple images are rendered in parallel, then the rendering has a bigger memory footprint. One advantage of using the remote rendering service is that the rendering will be done on the remote system, so your local system resources will not be affected by rendering.

## Alerting and render limits

Alert notifications can include images, but rendering many images at the same time can overload the server where the renderer is running. For instructions of how to configure this, see [concurrent_render_limit]({{< relref "../installation/configuration/#concurrent_render_limit" >}}).

## Install Grafana Image Renderer plugin

The [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) is a plugin that runs on the backend and handles rendering panels and dashboards as PNG images using headless Chrome.

To install the plugin, refer to the [Grafana Image Renderer Installation instructions](https://grafana.com/grafana/plugins/grafana-image-renderer/installation).

## Run in custom Grafana Docker image

 We recommend setting up another Docker container for rendering and using remote rendering. Refer to [Remote rendering service]({{< relref "#remote-rendering-service" >}}) for instructions.

If you still want to install the plugin in the Grafana Docker image, refer to [Build with Grafana Image Renderer plugin pre-installed]({{< relref "../installation/docker/#build-with-grafana-image-renderer-plugin-pre-installed" >}}).

## Remote rendering service

> Requires an internet connection.

The [Grafana Image Renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) can also be run as a remote HTTP rendering service. In this setup, Grafana renders an image by making a HTTP request to the remote rendering service, which in turn renders the image and returns it back in the HTTP response to Grafana.

You can run the remote HTTP rendering service using Docker or as a standalone Node.js application.

### Run in Docker

The following example shows how to run Grafana and the remote HTTP rendering service in two separate Docker containers using Docker Compose.

Create a `docker-compose.yml` with the following content:

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

And then run:

```bash
docker-compose up
```

## Run as standalone Node.js application

The following example describes how to build and run the remote HTTP rendering service as a standalone Node.js application and configure Grafana appropriately.

1. Clone the [Grafana image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer) Git repository.
2. Install dependencies and build:

    ```bash
    yarn install --pure-lockfile
    yarn run build
    ```

3. Run the server:

    ```bash
    node build/app.js server --port=8081
    ```

4. Update Grafana configuration:

    ```
    [rendering]
    server_url = http://localhost:8081/render
    callback_url = http://localhost:3000/
    ```

5. Restart Grafana.

## PhantomJS

> Starting from Grafana v7.0.0, all PhantomJS support has been removed. Please use the Grafana Image Renderer plugin or remote rendering service.

## Troubleshoot image rendering

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
are not installed in your system:

```bash
cd <grafana-image-render plugin directory>
ldd chrome-linux/chrome
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

On a minimal Centos installation, the following dependencies have been confirmed as needed for the image rendering to function:

```bash
libXcomposite libXdamage libXtst cups libXScrnSaver pango atk adwaita-cursor-theme adwaita-icon-theme at at-spi2-atk at-spi2-core cairo-gobject colord-libs dconf desktop-file-utils ed emacs-filesystem gdk-pixbuf2 glib-networking gnutls gsettings-desktop-schemas gtk-update-icon-cache gtk3 hicolor-icon-theme jasper-libs json-glib libappindicator-gtk3 libdbusmenu libdbusmenu-gtk3 libepoxy liberation-fonts liberation-narrow-fonts liberation-sans-fonts liberation-serif-fonts libgusb libindicator-gtk3 libmodman libproxy libsoup libwayland-cursor libwayland-egl libxkbcommon m4 mailx nettle patch psmisc redhat-lsb-core redhat-lsb-submod-security rest spax time trousers xdg-utils xkeyboard-config
```

### Certificate signed by internal certificate authorities

In many cases, Grafana runs on internal servers and uses certificates that have not been signed by a CA ([Certificate Authority](https://en.wikipedia.org/wiki/Certificate_authority)) known to Chrome, and therefore cannot be validated. Chrome internally uses NSS ([Network Security Services](https://en.wikipedia.org/wiki/Network_Security_Services)) for cryptogtraphic operations such as the validation of certificates.

If you are using the Grafana Image Renderer with a Grafana server that uses a certificate signed by such a custom CA (for example a company-internal CA), rendering images will fail and you will see messages like this in the Grafana log:

```
t=2019-12-04T12:39:22+0000 lvl=error msg="Render request failed" logger=rendering error=map[] url="https://192.168.106.101:3443/d-solo/zxDJxNaZk/graphite-metrics?orgId=1&refresh=1m&from=1575438321300&to=1575459921300&var-Host=master1&panelId=4&width=1000&height=500&tz=Europe%2FBerlin&render=1" timestamp=0001-01-01T00:00:00.000Z
t=2019-12-04T12:39:22+0000 lvl=error msg="Rendering failed." logger=context userId=1 orgId=1 uname=admin error="Rendering failed: Error: net::ERR_CERT_AUTHORITY_INVALID at https://192.168.106.101:3443/d-solo/zxDJxNaZk/graphite-metrics?orgId=1&refresh=1m&from=1575438321300&to=1575459921300&var-Host=master1&panelId=4&width=1000&height=500&tz=Europe%2FBerlin&render=1"
t=2019-12-04T12:39:22+0000 lvl=error msg="Request Completed" logger=context userId=1 orgId=1 uname=admin method=GET path=/render/d-solo/zxDJxNaZk/graphite-metrics status=500 remote_addr=192.168.106.101 time_ms=310 size=1722 referer="https://grafana.xxx-xxx/d/zxDJxNaZk/graphite-metrics?orgId=1&refresh=1m"
```

(The severity-level `error` in the above messages might be misspelled with a single `r`)

If this happens, then you have to add the certificate to the trust store. If you have the certificate file for the internal root CA in the file `internal-root-ca.crt.pem`, then use these commands to create a user specific NSS trust store for the Grafana user (`grafana` for the purpose of this example) and execute the following steps:

```[root@server ~]# [ -d /usr/share/grafana/.pki/nssdb ] || mkdir -p /usr/share/grafana/.pki/nssdb
[root@merver ~]# certutil -d sql:/usr/share/grafana/.pki/nssdb -A -n internal-root-ca -t C -i /etc/pki/tls/certs/internal-root-ca.crt.pem
[root@server ~]# chown -R grafana: /usr/share/grafana/.pki/nssdb
```

### Custom Chrome/Chromium

As a last resort, if you already have [Chrome](https://www.google.com/chrome/) or [Chromium](https://www.chromium.org/)
installed on your system, then you can configure [Grafana Image renderer plugin](#grafana-image-renderer-plugin) to use this
instead of the pre-packaged version of Chromium.

> Please note that this is not recommended, since you may encounter problems if the installed version of Chrome/Chromium is not
> compatible with the [Grafana Image renderer plugin](#grafana-image-renderer-plugin).

To override the path to the Chrome/Chromium executable, set an environment variable and make sure that it's available for the Grafana process. For example:

```bash
export GF_RENDERER_PLUGIN_CHROME_BIN="/usr/bin/chromium-browser"
```
