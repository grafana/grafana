---
aliases:
  - ../install/
  - ../installation/
  - ../installation/installation/
  - ../installation/requirements/
  - /docs/grafana/v2.1/installation/install/
description: Installation guide for Grafana
title: Install Grafana
weight: 100
---

# Install Grafana

This page lists the minimum hardware and software requirements to install Grafana.

To run Grafana, you must have a supported operating system, hardware that meets or exceeds minimum requirements, a supported database, and a supported browser.

Grafana uses other open source software. Refer to [package.json](https://github.com/grafana/grafana/blob/main/package.json) for a complete list.

## Supported operating systems

The following operating systems are supported for Grafana installation:

- [Debian / Ubuntu]({{< relref "debian/" >}})
- [RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)]({{< relref "rpm/" >}})
- [macOS]({{< relref "mac/" >}})
- [Windows]({{< relref "windows/" >}})

Installation of Grafana on other operating systems is possible, but it is neither recommended nor supported.

## Hardware recommendations

Grafana does not use a lot of resources and is very lightweight in use of memory and CPU.

Minimum recommended memory: 255 MB
Minimum recommended CPU: 1

Some features might require more memory or CPUs. Features require more resources include:

- [Server side rendering of images](https://grafana.com/grafana/plugins/grafana-image-renderer#requirements)
- [Alerting]({{< relref "../../alerting/" >}})
- [Data source proxy]({{< relref "../../developers/http_api/data_source/" >}})

## Supported databases

Grafana requires a database to store its configuration data, such as users, data sources, and dashboards. The exact requirements depend on the size of the Grafana installation and features used.

Grafana supports the following databases:

- [SQLite 3](https://www.sqlite.org/index.html)
- [MySQL 5.7+](https://www.mysql.com/support/supportedplatforms/database.html)
- [PostgreSQL 10+](https://www.postgresql.org/support/versioning/)

By default, Grafana installs with and uses SQLite, which is an embedded database stored in the Grafana installation location.

> **Note:** SQLite works well if your environment is small, but is not recommended when your environment starts growing. For more information about the limitations of SQLite, refer to [Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html). If you want high availability, you must use a MySQL or PostgreSQL database. For information about how to define the database configuration parameters inside the `grafana.ini` file, refer to [[database]](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#database).

Grafana will support the versions of these databases that are officially supported by the project at the time of a Grafana version's release. When a version becomes unsupported, Grafana may also drop support for that version. See the links above for the support policies for each project.

> **Note:** PostgreSQL versions 10.9, 11.4, and 12-beta2 are affected by a bug (tracked by the PostgreSQL project as [bug #15865](https://www.postgresql.org/message-id/flat/15865-17940eacc8f8b081%40postgresql.org)) which prevents those versions from being used with Grafana. The bug has been fixed in more recent versions of PostgreSQL.
> Grafana can report errors when relying on read-only MySQL servers, such as in high-availability failover scenarios or serverless AWS Aurora MySQL. This is a known issue; for more information, see [issue #13399](https://github.com/grafana/grafana/issues/13399).

## Supported web browsers

Grafana is supported in the current version of the following browsers. Older versions of these browsers might not be supported, so you should always upgrade to the latest version when using Grafana.

- Chrome/Chromium
- Firefox
- Safari
- Microsoft Edge
- Internet Explorer 11 is only fully supported in Grafana versions prior v6.0.

> **Note:** Always enable JavaScript in your browser. Running Grafana without JavaScript enabled in the browser is not supported.
