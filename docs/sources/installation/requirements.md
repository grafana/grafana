+++
title = "Requirements"
description = "Requirements for Grafana"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
[menu.docs]
name = "Requirements"
identifier = "requirements"
parent = "installation"
weight = -1
+++

# Requirements

This page includes useful information on the supported Operating Systems as well as the hardware requirements that are needed to install and use Grafana.

## Operating Systems

### Supported

- [Debian / Ubuntu](/installation/debian)
- [RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)](/installation/rpm)
- [Mac OS X](/installation/mac)
- [Windows](/installation/windows)

### Unsupported

Installation of Grafana on other operating systems is possible, but not supported. Please see the [building from source](/project/building_from_source/#building-grafana-from-source) guide for more information.

## Hardware requirements

Grafana does not use a lot of resources and is very lightweight in use of memory and CPU. Minimum recommendation is 255mb of memory and 1 CPU.

Depending on what features are being used and to what extent the requirements varies. Features that consume and requires more resources:

- Server side rendering of images
- [Alerting](/alerting/rules/)
- Data source proxy

## Database

Grafana requires a database to store its configuration data, e.g. users, data sources and dashboards. The exact requirements depend on the size of the Grafana installation (e.g. the number of users, data sources, dashboards, features in use etc).

Grafana supports the following databases:

- SQLite
- MySQL
- PostgreSQL

Per default Grafana ships with and uses SQLite which is an embedded database stored on disk in Grafana's installation location.

## Supported web browsers

Grafana is supported in the following browsers:

- Chrome/Chromium
- Firefox
- Safari
- Microsoft Edge

> Note 1: Older versions of above browsers may not be supported

> Note 2: Internet Explorer 11 is only fully supported in Grafana versions prior v6.0.

> Note 3: Running Grafana without JavaScript enabled in the browser is not supported

### Known issues

#### Problem with logging in using Safari 12

There is a known [iOS Safari 12 issue](https://bugs.webkit.org/show_bug.cgi?id=188165) that prevents the Grafana session cookie from being written after a successful login.
A quick workaround for this problem would be to configure [cookie_samesite](/installation/configuration/#cookie-samesite) to `none`. However, there is another known [Safari 12 issue](https://bugs.webkit.org/show_bug.cgi?id=198181) that threats `SameSite=none` as `strict` which also
prevents the Grafana session cookie from being written after a successful login.

To resolve using `none` as `SameSite` cookie attribute in combination with Safari 12, please upgrade to at least Grafana v6.3.3 which includes a fix.
