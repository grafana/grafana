---
description: Describes backing up a locally provisioned Grafana instance.
keywords:
  - grafana
  - backup
labels:
  products:
    - enterprise
    - oss
title: Back up Grafana
weight: 600
---

# Back Up Grafana

To back up a local Grafana deployment, you need to consider three aspects: configuration, plugin data, and Grafana data.

## Backing Up Configuration

You will need to copy any configuration files that you have modified in your Grafana deployment.  Copy the files from the configuration location to your backup repository.

### Config File Locations

- Default configuration from `$WORKING_DIR/conf/defaults.ini`
- Custom configuration from `$WORKING_DIR/conf/custom.ini`

{{% admonition type="note" %}}
If you have installed Grafana using the `deb` or `rpm`
packages, then your configuration file is located at
`/etc/grafana/grafana.ini`. This path is specified in the Grafana
init.d script using `--config` file parameter.
{{% /admonition %}}

## Backing Up Plugin Data

Installing plugins in Grafana creates a folder per plugin with its associated files and data.  You will need to copy all files and folders recursively from this location to your backup repository.

### Plugin Data Locations

- Default location for plugins in a binary or source install is `$WORKING_DIR/data/plugins`
- Default location for plugins in a `deb` or `rpm` package is `/var/lib/grafana/plugins`

{{% admonition type="note" %}}
If you have installed Grafana using the `deb` or `rpm`
packages, then your plugins are located at
`/var/lib/grafana/plugins` by default. This path is specified in the Grafana
init.d script using `--config` file parameter.
{{% /admonition %}}

## Backing Up Database

Dashboard and user data is stored in the Grafana database.  Depending on the database you are using you might need to use different tools to back this data up.

### SQLite

The default Grafana database is SQLite, which stores its data in a single file on disk.  To back this up, copy the SQLite database file to your backup repository.

{{% admonition type="note" %}}
You should shut down your Grafana service before backing up the SQLite database to preserve data integrity.
{{% /admonition %}}

#### SQLite Database Locations

- Default location for SQLite data in a binary or source install is `$WORKING_DIR/data/grafana.db`
- Default location for SQLite data in a `deb` or `rpm` package is `/var/lib/grafana/grafana.db`

{{% admonition type="note" %}}
If you have installed Grafana using the `deb` or `rpm`
packages, then your SQLite database is located at
`/var/lib/grafana/grafana.db` by default. This path is specified in the Grafana
init.d script using `--config` file parameter.
{{% /admonition %}}

### MySQL/MariaDB or PostgreSQL

Refer to your database documentation for backing up the Grafana database from these tools.