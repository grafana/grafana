+++
title = "Requirements"
description = "Requirements for Grafana"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
[menu.docs]
name = "Requirements"
identifier = "requirements"
parent = "installation"
weight = 100
+++

# Grafana requirements

This page lists the minimum hardware and software requirements to install Grafana.

To run Grafana, you must have a supported operating system, hardware that meets or exceeds minimum requirements, a supported database, and a supported browser

## Supported operating systems

The following operating systems are supported for Grafana installation:

- [Debian / Ubuntu]({{< relref "debian" >}})
- [RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)]({{< relref "rpm" >}})
- [macOS]({{< relref "mac" >}})
- [Windows]({{< relref "windows" >}})

While you can install Grafana on other operating systems, we do not recommend doing so and do not provide support for that use case.

Installation of Grafana on other operating systems is possible, but not supported.

## Hardware recommendations

Grafana does not use a lot of resources and is very lightweight in use of memory and CPU. 

Minimum recommended memory: 255 MB
Minimum recommended CPU: 1

Some features might require more memory or CPUs. Features require more resources include:

- [Server side rendering of images]({{< relref "../administration/image_rendering/#requirements" >}})
- [Alerting]({{< relref "../alerting/alerts-overview" >}})
- Data source proxy

## Supported databases

Grafana requires a database to store its configuration data, such as users, data sources, and dashboards. The exact requirements depend on the size of the Grafana installation and features used.

Grafana supports the following databases:

- SQLite
- MySQL
- PostgreSQL

By default, Grafana installs with and uses SQLite, which is an embedded database stored in the Grafana installation location.

> NOTE: PostgreSQL versions 9.5.18, 9.4.23, 9.6.14, 10.9, 11.4, and 12-beta2 are affected by a bug (tracked by the PostgreSQL project as [bug #15865](https://www.postgresql.org/message-id/flat/15865-17940eacc8f8b081%40postgresql.org)) which prevents those versions from being used with Grafana. The bug has been fixed in more recent versions of PostgreSQL.

## Supported web browsers

Grafana is supported in the current version of the following browsers. Older versions of these browsers might not be supported, so you should always upgrade to the latest version when using Grafana.

- Chrome/Chromium
- Firefox
- Safari
- Microsoft Edge
- Internet Explorer 11 is only fully supported in Grafana versions prior v6.0.

> Note: Always enable JavaScript in your browser. Running Grafana without JavaScript enabled in the browser is not supported.
