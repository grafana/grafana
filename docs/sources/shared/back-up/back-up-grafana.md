---
labels:
  products:
    - enterprise
    - oss
title: Upgrade guide common tasks
---

This topic explains how to back up a local Grafana deployment, including configuration, plugin data, and the Grafana database.

## Back up the Grafana configuration file

Copy Grafana configuration files that you might have modified in your Grafana deployment to a backup directory.

The Grafana configuration files are located in the following directories:

- Default configuration: `$WORKING_DIR/conf/defaults.ini`
- Custom configuration: `$WORKING_DIR/conf/custom.ini`

{{% admonition type="note" %}}
If you installed Grafana using the `deb` or `rpm` packages, then your configuration file is located at
`/etc/grafana/grafana.ini`. This path is specified in the Grafana `init.d` script using `--config` file parameter.
{{% /admonition %}}

## Back up plugin data

Installing plugins in Grafana creates a folder for each plugin with its associated files and data. Copy all files and folders recursively from this location to your backup repository.

The Grafana plugin files are located in the following directories:

- Default location for plugins in a binary or source installation: `$WORKING_DIR/data/plugins`
- Default location for plugins in a `deb` or `rpm` package: `/var/lib/grafana/plugins`. This path is specified in the Grafana init.d script using `--config` file parameter.
