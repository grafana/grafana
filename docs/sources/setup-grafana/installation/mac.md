---
aliases:
  - /docs/grafana/latest/installation/mac/
  - /docs/grafana/latest/setup-grafana/installation/mac/
description: Installing Grafana on macOS
title: Install on macOS
weight: 600
---

# Install on macOS

This page explains how to install Grafana and get the service running on your macOS.

**Note on upgrading:** While the process for upgrading Grafana is very similar to installing Grafana, there are some key backup steps you should perform. Before you perform an upgrade, read [Upgrading Grafana]({{< relref "../upgrade-grafana/" >}}) for tips and guidance on updating an existing installation.

## Install with Homebrew

Use [Homebrew](http://brew.sh/) to install the most recent released version of Grafana using Homebrew package.

1. On the Homebrew homepage, search for Grafana. The last stable and released version is listed.
1. Open a terminal and enter:

   ```
   brew update
   brew install grafana
   ```

   The brew page downloads and untars the files into:

   - `/usr/local/Cellar/grafana/[version]` (Homebrew v2)
   - `/opt/homebrew/Cellar/grafana/[version]` (Homebrew v3)

1. Start Grafana using the command:
   ```bash
   brew services start grafana
   ```

## Install standalone macOS binaries

To install a nightly build, or to install the latest version of Grafana without Homebrew, go to the [Grafana download page](https://grafana.com/grafana/download?platform=mac).

1. Select the Grafana version you want to install. By default, the most recent released version is selected.

   > **Note:** The downloads page lists only finished releases. If you want to install a beta version, click [Nightly ] **Nightly Builds** and then select a version.

1. Select an **Edition**.
   - **Open Source** - Functionally identical to the enterprise version, but you will need to download the enterprise version if you want enterprise features.
   - **Enterprise** - Recommended download. Functionally identical to the open source version, but includes features you can unlock with a license if you so choose.
1. Click **Mac**.
1. Open a terminal and download the binary using the cURL command. The following example shows Grafana 7.1.5 version:
   ```bash
   curl -O https://dl.grafana.com/oss/release/grafana-7.1.5.darwin-amd64.tar.gz
   ```
1. Untar the gz file and copy the files to the location of your preference.
1. To start Grafana service, go to the directory and run the command:
   ```bash
   ./bin/grafana-server web
   ```

## Next steps

Refer to the [Getting Started]({{< relref "../../getting-started/build-first-dashboard/" >}}) guide for information about logging in, setting up data sources, and so on. Also, refer to the [Configuration]({{< relref "../configure-grafana/" >}}) page for details on options for customizing your environment, logging, database, and so on.

## Upgrade

**Using Homebrew**

To upgrade Grafana, use the reinstall command:

```bash
brew update
brew reinstall grafana
```
