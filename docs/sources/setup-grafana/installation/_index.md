---
aliases:
  - ../install/
  - ../installation/
  - ../installation/installation/
  - ../installation/requirements/
  - /docs/grafana/v2.1/installation/install/
  - ./installation/rpm/
description: Installation guide for Grafana
labels:
  products:
    - enterprise
    - oss
title: Install Grafana
weight: 100
---

# Install Grafana

This page lists the minimum hardware and software requirements to install Grafana.

To run Grafana, you must have a supported operating system, hardware that meets or exceeds minimum requirements, a supported database, and a supported browser.

The following video guides you through the steps and common commands for installing Grafana on various operating systems as described in this document.

{{< youtube id="f-x_p2lvz8s" >}}

Grafana relies on other open source software to operate. For a list of open source software that Grafana uses, refer to [package.json](https://github.com/grafana/grafana/blob/main/package.json).

## Supported operating systems

Grafana supports the following operating systems:

- [Debian or Ubuntu](debian/)
- [RHEL or Fedora](redhat-rhel-fedora/)
- [SUSE or openSUSE](suse-opensuse/)
- [macOS](mac/)
- [Windows](windows/)

{{< admonition type="note" >}}
Installation of Grafana on other operating systems is possible, but is not recommended or supported.
{{< /admonition >}}

## Hardware recommendations

Grafana requires the minimum system resources:

- Minimum recommended memory: 512 MB
- Minimum recommended CPU: 1 core

Some features might require more memory or CPUs, including:

- [Server side rendering of images](/grafana/plugins/grafana-image-renderer#requirements)
- [Alerting](../../alerting/)
- [Data source proxy](../../developers/http_api/data_source/)

## Supported databases

Grafana requires a database to store its configuration data, such as users, data sources, and dashboards. The exact requirements depend on the size of the Grafana installation and the features you use.

Grafana supports the following databases:

- [SQLite 3](https://www.sqlite.org/index.html)
- [MySQL 8.0+](https://www.mysql.com/support/supportedplatforms/database.html)
- [PostgreSQL 12+](https://www.postgresql.org/support/versioning/)

By default Grafana uses an embedded SQLite database, which is stored in the Grafana installation location.

{{< admonition type="note" >}}
SQLite works well if your environment is small, but is not recommended when your environment starts growing. For more information about the limitations of SQLite, refer to [Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html). If you want [high availability](/docs/grafana/latest/setup-grafana/set-up-for-high-availability), you must use either a MySQL or PostgreSQL database. For information about how to define the database configuration parameters inside the `grafana.ini` file, refer to [[database]](/docs/grafana/latest/setup-grafana/configure-grafana/#database).
{{< /admonition >}}

Grafana supports the versions of these databases that are officially supported by the project at the time a version of Grafana is released. When a Grafana version becomes unsupported, Grafana Labs might also drop support for that database version. See the links above for the support policies for each project.

{{< admonition type="note" >}}
PostgreSQL versions 10.9, 11.4, and 12-beta2 are affected by a bug (tracked by the PostgreSQL project as [bug #15865](https://www.postgresql.org/message-id/flat/15865-17940eacc8f8b081%40postgresql.org)) which prevents those versions from being used with Grafana. The bug has been fixed in more recent versions of PostgreSQL.
{{< /admonition >}}

{{< admonition type="note" >}}
Grafana binaries and images might not work with unsupported databases, even if they claim to be drop-in or replicate the API to their best.
Binaries and images built with [BoringCrypto](https://pkg.go.dev/crypto/internal/boring) may have different problems than other distributions of Grafana.
{{< /admonition >}}

> Grafana can report errors when relying on read-only MySQL servers, such as in high-availability failover scenarios or serverless AWS Aurora MySQL. This is a known issue; for more information, see [issue #13399](https://github.com/grafana/grafana/issues/13399).

## Supported web browsers

Grafana supports the current version of the following browsers. Older versions of these browsers might not be supported, so you should always upgrade to the latest browser version when using Grafana.

{{< admonition type="note" >}}
Enable JavaScript in your browser. Running Grafana without JavaScript enabled in the browser is not supported.
{{< /admonition >}}

- Chrome/Chromium
- Firefox
- Safari
- Microsoft Edge
