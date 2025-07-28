---
aliases:
  - ../administration/image_rendering/
  - ../image-rendering/
description: Image rendering
keywords:
  - grafana
  - image
  - rendering
  - plugin
labels:
  products:
    - enterprise
    - oss
title: Set up image rendering
weight: 1000
---

# Set up image rendering

Grafana supports automatic rendering of panels as PNG images. This allows Grafana to automatically generate images of your panels to include in alert notifications, [PDF export](../../dashboards/create-reports/#export-dashboard-as-pdf), and [Reporting](../../dashboards/create-reports/). PDF Export and Reporting are available only in [Grafana Enterprise](../../introduction/grafana-enterprise/) and [Grafana Cloud](/docs/grafana-cloud/).

While an image is being rendered, the PNG image is temporarily written to the file system. When the image is rendered, the PNG image is temporarily written to the `png` folder in the Grafana `data` folder.

A background job runs every 10 minutes and removes temporary images. You can configure how long an image should be stored before being removed by configuring the [temp_data_lifetime](../configure-grafana/#temp_data_lifetime) setting.

You can also render a PNG by hovering over the panel to display the actions menu in the top-right corner, and then clicking **Share > Share link**. The **Render image** option is displayed in the link settings.

## Alerting and render limits

Alert notifications can include images, but rendering many images at the same time can overload the server where the renderer is running. For instructions of how to configure this, see [max_concurrent_screenshots](../configure-grafana/#max_concurrent_screenshots).

## Install Grafana Image Renderer plugin

{{< admonition type="note" >}}
All PhantomJS support has been removed. Instead, use the Grafana Image Renderer plugin or remote rendering service.
{{< /admonition >}}

To install the plugin, refer to the [Grafana Image Renderer Installation instructions](/grafana/plugins/grafana-image-renderer/?tab=installation#installation).

### Memory requirements

Rendering images requires a lot of memory, mainly because Grafana creates browser instances in the background for the actual rendering. Grafana recommends a minimum of 16GB of free memory on the system rendering images.

Rendering multiple images in parallel requires an even bigger memory footprint. You can use the remote rendering service in order to render images on a remote system, so your local system resources are not affected.

## Configuration

The Grafana Image Renderer plugin has a number of configuration options that are used in plugin or remote rendering modes.

In plugin mode, you can specify them directly in the [Grafana configuration file](../configure-grafana/#plugingrafana-image-renderer).

In remote rendering mode, you can specify them in a `.json` [configuration file](#configuration-file) or, for some of them, you can override the configuration defaults using environment variables.

### Configuration file

You can update your settings by using a configuration file, see [default.json](https://github.com/grafana/grafana-image-renderer/tree/master/default.json) for defaults. Note that any configured environment variable takes precedence over configuration file settings.

You can volume mount your custom configuration file when starting the docker container:

```bash
docker run -d --name=renderer --network=host -v /some/path/config.json:/home/nonroot/config.json grafana/grafana-image-renderer:latest
```

You can see a docker-compose example using a custom configuration file [here](https://github.com/grafana/grafana-image-renderer/tree/master/devenv/docker/custom-config).

{{< admonition type="note" >}}
The configuration files were located in `/usr/src/app` up until v4.0.0 and later.
After this point, they are located in `/home/nonroot`.
{{< /admonition >}}

### Security

{{< admonition type="note" >}}
This feature is available in Image Renderer v3.6.1 and later.
{{< /admonition >}}

You can restrict access to the rendering endpoint by specifying a secret token. The token should be configured in the Grafana configuration file and the renderer configuration file. This token is important when you run the plugin in remote rendering mode.

Renderer versions v3.6.1 or later require a Grafana version with this feature. These include:

- Grafana v9.1.2 or later
- Grafana v9.0.8 or later patch releases
- Grafana v8.5.11 or later patch releases
- Grafana v8.4.11 or later patch releases
- Grafana v8.3.11 or later patch releases

```bash
AUTH_TOKEN=-
```

```json
{
  "service": {
    "security": {
      "authToken": "-"
    }
  }
}
```

See [Grafana configuration](../configure-grafana/#renderer_token) for how to configure the token in Grafana.

### Rendering mode

You can instruct how headless browser instances are created by configuring a rendering mode. Default is `default`, other supported values are `clustered` and `reusable`.

#### Default

Default mode will create a new browser instance on each request. When handling multiple concurrent requests, this mode increases memory usage as it will launch multiple browsers at the same time. If you want to set a maximum number of browser to open, you'll need to use the [clustered mode](#clustered).

{{< admonition type="note" >}}
When using the `default` mode, it's recommended to not remove the default Chromium flag `--disable-gpu`. When receiving a lot of concurrent requests, not using this flag can cause Puppeteer `newPage` function to freeze, causing request timeouts and leaving browsers open.
{{< /admonition >}}

```bash
RENDERING_MODE=default
```

```json
{
  "rendering": {
    "mode": "default"
  }
}
```

#### Clustered

With the `clustered` mode, you can configure how many browser instances or incognito pages can execute concurrently. Default is `browser` and will ensure a maximum amount of browser instances can execute concurrently. Mode `context` will ensure a maximum amount of incognito pages can execute concurrently. You can also configure the maximum concurrency allowed, which per default is `5`, and the maximum duration of a rendering request, which per default is `30` seconds.

Using a cluster of incognito pages is more performant and consumes less CPU and memory than a cluster of browsers. However, if one page crashes it can bring down the entire browser with it (making all the rendering requests happening at the same time fail). Also, each page isn't guaranteed to be totally clean (cookies and storage might bleed-through as seen [here](https://bugs.chromium.org/p/chromium/issues/detail?id=754576)).

```bash
RENDERING_MODE=clustered
RENDERING_CLUSTERING_MODE=browser
RENDERING_CLUSTERING_MAX_CONCURRENCY=5
RENDERING_CLUSTERING_TIMEOUT=30
```

```json
{
  "rendering": {
    "mode": "clustered",
    "clustering": {
      "mode": "browser",
      "maxConcurrency": 5,
      "timeout": 30
    }
  }
}
```

#### Reusable (experimental)

When using the rendering mode `reusable`, one browser instance will be created and reused. A new incognito page will be opened for each request. This mode is experimental since, if the browser instance crashes, it will not automatically be restarted. You can achieve a similar behavior using `clustered` mode with a high `maxConcurrency` setting.

```bash
RENDERING_MODE=reusable
```

```json
{
  "rendering": {
    "mode": "reusable"
  }
}
```

#### Optimize the performance, CPU and memory usage of the image renderer

The performance and resources consumption of the different modes depend a lot on the number of concurrent requests your service is handling. To understand how many concurrent requests your service is handling, [monitor your image renderer service](monitoring/).

With no concurrent requests, the different modes show very similar performance and CPU / memory usage.

When handling concurrent requests, we see the following trends:

- To improve performance and reduce CPU and memory consumption, use [clustered](#clustered) mode with `RENDERING_CLUSTERING_MODE` set as `context`. This parallelizes incognito pages instead of browsers.
- If you use the [clustered](#clustered) mode with a `maxConcurrency` setting below your average number of concurrent requests, performance will drop as the rendering requests will need to wait for the other to finish before getting access to an incognito page / browser.

To achieve better performance, monitor the machine on which your service is running. If you don't have enough memory and / or CPU, every rendering step will be slower than usual, increasing the duration of every rendering request.

### Other available settings

{{< admonition type="note" >}}
Please note that not all settings are available using environment variables. If there is no example using environment variable below, it means that you need to update the configuration file.
{{< /admonition >}}

#### HTTP host

Change the listening host of the HTTP server. Default is unset and will use the local host.

```bash
HTTP_HOST=localhost
```

```json
{
  "service": {
    "host": "localhost"
  }
}
```

#### HTTP port

Change the listening port of the HTTP server. Default is `8081`. Setting `0` will automatically assign a port not in use.

```bash
HTTP_PORT=0
```

```json
{
  "service": {
    "port": 0
  }
}
```

#### HTTP protocol

{{< admonition type="note" >}}
HTTPS protocol is supported in the image renderer v3.11.0 and later.
{{< /admonition >}}

Change the protocol of the server, it can be `http` or `https`. Default is `http`.

```bash
HTTP_PROTOCOL=https
```

```json
{
  "service": {
    "protocol": "https"
  }
}
```

#### HTTPS certificate and key file

Path to the image renderer certificate and key file used to start an HTTPS server.

```bash
HTTP_CERT_FILE=./path/to/cert
HTTP_CERT_KEY=./path/to/key
```

```json
{
  "service": {
    "certFile": "./path/to/cert",
    "certKey": "./path/to/key"
  }
}
```

#### HTTPS min TLS version

Minimum TLS version allowed. Accepted values are: `TLSv1.2`, `TLSv1.3`. Default is `TLSv1.2`.

```bash
HTTP_MIN_TLS_VERSION=TLSv1.2
```

```json
{
  "service": {
    "minTLSVersion": "TLSv1.2"
  }
}
```

#### Enable Prometheus metrics

You can enable [Prometheus](https://prometheus.io/) metrics endpoint `/metrics` using the environment variable `ENABLE_METRICS`. Node.js and render request duration metrics are included, see [Enable Prometheus metrics endpoint](monitoring/#enable-prometheus-metrics-endpoint) for details.

Default is `false`.

```bash
ENABLE_METRICS=true
```

```json
{
  "service": {
    "metrics": {
      "enabled": true,
      "collectDefaultMetrics": true,
      "requestDurationBuckets": [1, 5, 7, 9, 11, 13, 15, 20, 30]
    }
  }
}
```

#### Enable detailed timing metrics

With the [Prometheus metrics enabled](#enable-prometheus-metrics), you can also enable detailed metrics to get the duration of every rendering step.

Default is `false`.

```bash
# Available from v3.9.0+
RENDERING_TIMING_METRICS=true
```

```json
{
  "rendering": {
    "timingMetrics": true
  }
}
```

#### Log level

Change the log level. Default is `info` and will include log messages with level `error`, `warning` and `info`.

```bash
LOG_LEVEL=debug
```

```json
{
  "service": {
    "logging": {
      "level": "debug",
      "console": {
        "json": false,
        "colorize": true
      }
    }
  }
}
```

#### Verbose logging

Instruct headless browser instance whether to capture and log verbose information when rendering an image. Default is `false` and will only capture and log error messages. When enabled (`true`) debug messages are captured and logged as well.

Note that you need to change log level to `debug`, see above, for the verbose information to be included in the logs.

```bash
RENDERING_VERBOSE_LOGGING=true
```

```json
{
  "rendering": {
    "verboseLogging": true
  }
}
```

#### Capture browser output

Instruct headless browser instance whether to output its debug and error messages into running process of remote rendering service. Default is `false`.
This can be useful to enable (`true`) when troubleshooting.

```bash
RENDERING_DUMPIO=true
```

```json
{
  "rendering": {
    "dumpio": true
  }
}
```

#### Tracing

{{< admonition type="note" >}}
Tracing is supported in the image renderer v3.12.6 and later.
{{< /admonition >}}

Set the tracing URL to enable OpenTelemetry Tracing. The default is empty (disabled).
You can also configure the service name that will be set in the traces. The default is `grafana-image-renderer`.

```bash
RENDERING_TRACING_URL="http://localhost:4318/v1/traces"
```

```json
{
  "rendering": {
    "tracing": {
      "url": "http://localhost:4318/v1/traces",
      "serviceName": "grafana-renderer"
    }
  }
}
```

#### Custom Chrome/Chromium

If you already have [Chrome](https://www.google.com/chrome/) or [Chromium](https://www.chromium.org/)
installed on your system, then you can use this instead of the pre-packaged version of Chromium.

{{< admonition type="note" >}}
Please note that this is not recommended, since you may encounter problems if the installed version of Chrome/Chromium is not compatible with the [Grafana Image renderer plugin](/grafana/plugins/grafana-image-renderer).
{{< /admonition >}}

You need to make sure that the Chrome/Chromium executable is available for the Grafana/image rendering service process.

```bash
CHROME_BIN="/usr/bin/chromium-browser"
```

```json
{
  "rendering": {
    "chromeBin": "/usr/bin/chromium-browser"
  }
}
```

#### Start browser with additional arguments

Additional arguments to pass to the headless browser instance. Defaults are `--no-sandbox,--disable-gpu`. The list of Chromium flags can be found [here](https://peter.sh/experiments/chromium-command-line-switches/) and the list of flags used as defaults by Puppeteer can be found [there](https://cri.dev/posts/2020-04-04-Full-list-of-Chromium-Puppeteer-flags/). Multiple arguments is separated with comma-character.

```bash
RENDERING_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-accelerated-2d-canvas,--disable-gpu,--window-size=1280x758
```

```json
{
  "rendering": {
    "args": [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1280x758"
    ]
  }
}
```

#### Ignore HTTPS errors

Instruct headless browser instance whether to ignore HTTPS errors during navigation. Per default HTTPS errors are not ignored.
Due to the security risk it's not recommended to ignore HTTPS errors.

```bash
IGNORE_HTTPS_ERRORS=true
```

```json
{
  "rendering": {
    "ignoresHttpsErrors": true
  }
}
```

#### Default timezone

Instruct headless browser instance to use a default timezone when not provided by Grafana, .e.g. when rendering panel image of alert. See [ICU’s metaZones.txt](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs. Fallbacks to `TZ` environment variable if not set.

```bash
BROWSER_TZ=Europe/Stockholm
```

```json
{
  "rendering": {
    "timezone": "Europe/Stockholm"
  }
}
```

#### Default language

Instruct headless browser instance to use a default language when not provided by Grafana, e.g. when rendering panel image of alert.
Refer to the HTTP header Accept-Language to understand how to format this value.

```bash
# Available from v3.9.0+
RENDERING_LANGUAGE="fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5"
```

```json
{
  "rendering": {
    "acceptLanguage": "fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5"
  }
}
```

#### Viewport width

Default viewport width when width is not specified in the rendering request. Default is `1000`.

```bash
# Available from v3.9.0+
RENDERING_VIEWPORT_WIDTH=1000
```

```json
{
  "rendering": {
    "width": 1000
  }
}
```

#### Viewport height

Default viewport height when height is not specified in the rendering request. Default is `500`.

```bash
# Available from v3.9.0+
RENDERING_VIEWPORT_HEIGHT=500
```

```json
{
  "rendering": {
    "height": 500
  }
}
```

#### Viewport maximum width

Limit the maximum viewport width that can be requested. Default is `3000`.

```bash
# Available from v3.9.0+
RENDERING_VIEWPORT_MAX_WIDTH=1000
```

```json
{
  "rendering": {
    "maxWidth": 1000
  }
}
```

#### Viewport maximum height

Limit the maximum viewport height that can be requested. Default is `3000`.

```bash
# Available from v3.9.0+
RENDERING_VIEWPORT_MAX_HEIGHT=500
```

```json
{
  "rendering": {
    "maxHeight": 500
  }
}
```

#### Device scale factor

Specify default device scale factor for rendering images. `2` is enough for monitor resolutions, `4` would be better for printed material. Setting a higher value affects performance and memory. Default is `1`.
This can be overridden in the rendering request.

```bash
# Available from v3.9.0+
RENDERING_VIEWPORT_DEVICE_SCALE_FACTOR=2
```

```json
{
  "rendering": {
    "deviceScaleFactor": 2
  }
}
```

#### Maximum device scale factor

Limit the maximum device scale factor that can be requested. Default is `4`.

```bash
# Available from v3.9.0+
RENDERING_VIEWPORT_MAX_DEVICE_SCALE_FACTOR=4
```

```json
{
  "rendering": {
    "maxDeviceScaleFactor": 4
  }
}
```

#### Page zoom level

The following command sets a page zoom level. The default value is `1`. A value of `1.5` equals 150% zoom.

```bash
RENDERING_VIEWPORT_PAGE_ZOOM_LEVEL=1
```

```json
{
  "rendering": {
    "pageZoomLevel": 1
  }
}
```
