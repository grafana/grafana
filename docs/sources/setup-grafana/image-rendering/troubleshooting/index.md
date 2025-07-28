---
aliases:
  - ../../image-rendering/troubleshooting/
description: Image rendering troubleshooting
keywords:
  - grafana
  - image
  - rendering
  - plugin
  - troubleshooting
labels:
  products:
    - enterprise
    - oss
menuTitle: Troubleshooting
title: Troubleshoot image rendering
weight: 200
---

# Troubleshoot image rendering

In this section, you'll learn how to enable logging for the image renderer and you'll find the most common issues.

## Enable debug logging

To troubleshoot the image renderer, different kind of logs are available.

You can enable debug log messages for rendering in the Grafana configuration file and inspect the Grafana server logs.

```bash
[log]
filters = rendering:debug
```

You can also enable more logs in image renderer service itself by enabling [debug logging](#enable-debug-logging).

## Missing libraries

The plugin and rendering service uses [Chromium browser](https://www.chromium.org/) which depends on certain libraries.
If you don't have all of those libraries installed in your system you may encounter errors when trying to render an image, e.g.

```bash
Rendering failed: Error: Failed to launch chrome!/var/lib/grafana/plugins/grafana-image-renderer/chrome-linux/chrome:
error while loading shared libraries: libX11.so.6: cannot open shared object file: No such file or directory\n\n\nTROUBLESHOOTING: https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md
```

In general you can use the [`ldd`](<https://en.wikipedia.org/wiki/Ldd_(Unix)>) utility to figure out what shared libraries
are not installed in your system:

```bash
cd <grafana-image-render plugin directory>
ldd chrome-headless-shell/linux-132.0.6781.0/chrome-headless-shell-linux64/chrome-headless-shell
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

You can find a reference to all the relevant Debian packages for the service to function [in the Dockerfile](https://github.com/grafana/grafana-image-renderer/blob/master/Dockerfile).
If you are using an operating system that is not Debian 12, you should look up what each of those packages are called on your system.

## Certificate signed by internal certificate authorities

In many cases, Grafana runs on internal servers and uses certificates that have not been signed by a CA ([Certificate Authority](https://en.wikipedia.org/wiki/Certificate_authority)) known to Chrome, and therefore cannot be validated. Chrome internally uses NSS ([Network Security Services](https://en.wikipedia.org/wiki/Network_Security_Services)) for cryptographic operations such as the validation of certificates.

If you are using the Grafana Image Renderer with a Grafana server that uses a certificate signed by such a custom CA (for example a company-internal CA), rendering images will fail and you will see messages like this in the Grafana log:

```
t=2019-12-04T12:39:22+0000 lvl=error msg="Render request failed" logger=rendering error=map[] url="https://192.168.106.101:3443/d-solo/zxDJxNaZk/graphite-metrics?orgId=1&refresh=1m&from=1575438321300&to=1575459921300&var-Host=master1&panelId=4&width=1000&height=500&tz=Europe%2FBerlin&render=1" timestamp=0001-01-01T00:00:00.000Z
t=2019-12-04T12:39:22+0000 lvl=error msg="Rendering failed." logger=context userId=1 orgId=1 uname=admin error="Rendering failed: Error: net::ERR_CERT_AUTHORITY_INVALID at https://192.168.106.101:3443/d-solo/zxDJxNaZk/graphite-metrics?orgId=1&refresh=1m&from=1575438321300&to=1575459921300&var-Host=master1&panelId=4&width=1000&height=500&tz=Europe%2FBerlin&render=1"
t=2019-12-04T12:39:22+0000 lvl=error msg="Request Completed" logger=context userId=1 orgId=1 uname=admin method=GET path=/render/d-solo/zxDJxNaZk/graphite-metrics status=500 remote_addr=192.168.106.101 time_ms=310 size=1722 referer="https://grafana.xxx-xxx/d/zxDJxNaZk/graphite-metrics?orgId=1&refresh=1m"
```

If this happens, then you have to add the certificate to the trust store. If you have the certificate file for the internal root CA in the file `internal-root-ca.crt.pem`, then use these commands to create a user specific NSS trust store for the Grafana user (`grafana` for the purpose of this example) and execute the following steps:

**Linux:**

```
[root@server ~]# [ -d /usr/share/grafana/.pki/nssdb ] || mkdir -p /usr/share/grafana/.pki/nssdb
[root@server ~]# certutil -d sql:/usr/share/grafana/.pki/nssdb -A -n internal-root-ca -t C -i /etc/pki/tls/certs/internal-root-ca.crt.pem
[root@server ~]# chown -R grafana: /usr/share/grafana/.pki/nssdb
```

You may also have to use other tooling than `certutil`, such as `update-ca-certificates` and its accompanying paths.
This depends on the Linux distribution you use; distributions often have a wiki with this type of information.

**Windows:**

```
certutil –addstore "Root" <path>/internal-root-ca.crt.pem
```

**Container:**

```Dockerfile
FROM grafana/grafana-image-renderer:latest

# Elevate our permissions to access system resources.
USER root

RUN mkdir -p /usr/local/share/ca-certificates/
# Convert from .pem to .crt
RUN openssl x509 -inform PEM -in rootCA.pem -out /usr/local/share/ca-certificates/rootCA.crt

# Regenerate the CA certificates in the container.
RUN update-ca-certificates --fresh

# Reassume the nonroot user for the service execution.
USER nonroot

# Some CA certificates also need to explicitly be included in the user's network security services database.
# certutil is shipped in v4.0.8 and onwards of the image.
RUN mkdir -p /home/nonroot/.pki/nssdb
RUN certutil -d sql:/home/nonroot/.pki/nssdb -A -n internal-root-ca -t C -i /usr/local/share/ca-certificates/rootCA.crt
```

{{< admonition type="note" >}}
The container image was based on Alpine until v4.0.0.
After this point, it is based on distroless Debian.
{{< /admonition >}}

## Custom Chrome/Chromium

As a last resort, if you already have [Chrome](https://www.google.com/chrome/) or [Chromium](https://www.chromium.org/)
installed on your system, then you can configure the Grafana Image renderer plugin to use this
instead of the pre-packaged version of Chromium.

{{< admonition type="note" >}}
Please note that this is not recommended, since you may encounter problems if the installed version of Chrome/Chromium is not
compatible with the [Grafana Image renderer plugin](/grafana/plugins/grafana-image-renderer).
{{< /admonition >}}

To override the path to the Chrome/Chromium executable in plugin mode, set an environment variable and make sure that it's available for the Grafana process. For example:

```bash
export GF_PLUGIN_RENDERING_CHROME_BIN="/usr/bin/chromium-browser"
```

In remote rendering mode, you need to set the environment variable or update the configuration file and make sure that it's available for the image rendering service process:

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
