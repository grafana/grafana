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
title: Troubleshooting
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

You can also enable more logs in image renderer service itself by:

- Increasing the [log level]({{< relref ".#log-level" >}}).
- Enabling [verbose logging]({{< relref "./#verbose-logging" >}}).
- [Capturing headless browser output]({{< relref "./#capture-browser-output" >}}).

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

On Ubuntu 18.10 the following dependencies are required for the image rendering to function.

```bash
libx11-6 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrender1 libxtst6 libglib2.0-0 libnss3 libcups2  libdbus-1-3 libxss1 libxrandr2 libgtk-3-0 libasound2 libxcb-dri3-0 libgbm1 libxshmfence1
```

**Debian:**

On Debian 9 (Stretch) the following dependencies are required for the image rendering to function.

```bash
libx11 libcairo libcairo2 libxtst6 libxcomposite1 libx11-xcb1 libxcursor1 libxdamage1 libnss3 libcups libcups2 libxss libxss1 libxrandr2 libasound2 libatk1.0-0 libatk-bridge2.0-0 libpangocairo-1.0-0 libgtk-3-0 libgbm1 libxshmfence1
```

On Debian 10 (Buster) the following dependencies are required for the image rendering to function.

```bash
libxdamage1 libxext6 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libasound2 libatk1.0-0 libatk-bridge2.0-0 libpangocairo-1.0-0 libpango-1.0-0 libcairo2 libatspi2.0-0 libgtk3.0-cil libgdk3.0-cil libx11-xcb-dev libgbm1 libxshmfence1
```

**Centos:**

On a minimal CentOS 7 installation, the following dependencies are required for the image rendering to function:

```bash
libXcomposite libXdamage libXtst cups libXScrnSaver pango atk adwaita-cursor-theme adwaita-icon-theme at at-spi2-atk at-spi2-core cairo-gobject colord-libs dconf desktop-file-utils ed emacs-filesystem gdk-pixbuf2 glib-networking gnutls gsettings-desktop-schemas gtk-update-icon-cache gtk3 hicolor-icon-theme jasper-libs json-glib libappindicator-gtk3 libdbusmenu libdbusmenu-gtk3 libepoxy liberation-fonts liberation-narrow-fonts liberation-sans-fonts liberation-serif-fonts libgusb libindicator-gtk3 libmodman libproxy libsoup libwayland-cursor libwayland-egl libxkbcommon m4 mailx nettle patch psmisc redhat-lsb-core redhat-lsb-submod-security rest spax time trousers xdg-utils xkeyboard-config alsa-lib
```

On a minimal CentOS 8 installation, the following dependencies are required for the image rendering to function:

```bash
libXcomposite libXdamage libXtst cups libXScrnSaver pango atk adwaita-cursor-theme adwaita-icon-theme at at-spi2-atk at-spi2-core cairo-gobject colord-libs dconf desktop-file-utils ed emacs-filesystem gdk-pixbuf2 glib-networking gnutls gsettings-desktop-schemas gtk-update-icon-cache gtk3 hicolor-icon-theme jasper-libs json-glib libappindicator-gtk3 libdbusmenu libdbusmenu-gtk3 libepoxy liberation-fonts liberation-narrow-fonts liberation-sans-fonts liberation-serif-fonts libgusb libindicator-gtk3 libmodman libproxy libsoup libwayland-cursor libwayland-egl libxkbcommon m4 mailx nettle patch psmisc redhat-lsb-core redhat-lsb-submod-security rest spax time trousers xdg-utils xkeyboard-config alsa-lib libX11-xcb
```

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

**Windows:**

```
certutil –addstore "Root" <path>/internal-root-ca.crt.pem
```

## Custom Chrome/Chromium

As a last resort, if you already have [Chrome](https://www.google.com/chrome/) or [Chromium](https://www.chromium.org/)
installed on your system, then you can configure the [Grafana Image renderer plugin](../#custom-chromechromium) to use this
instead of the pre-packaged version of Chromium.

> **Note:** Please note that this is not recommended, since you may encounter problems if the installed version of Chrome/Chromium is not
> compatible with the [Grafana Image renderer plugin](https://grafana.com/grafana/plugins/grafana-image-renderer).

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
