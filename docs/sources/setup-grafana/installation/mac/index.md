---
aliases:
  - ../../installation/mac/
description: How to install Grafana OSS or Enterprise on macOS
title: Install Grafana on macOS
menuTitle: macOS
weight: 600
---

# Install Grafana on macOS

This page explains how to install Grafana on macOS.

## Install Grafana on macOS using Homebrew

To install Grafana on macOS using Homebrew, complete the following steps:

1. On the [Homebrew](http://brew.sh/) homepage, search for Grafana.

   The last stable and released version is listed.

1. Open a terminal and run the following commands:

   ```
   brew update
   brew install grafana
   ```

   The brew page downloads and untars the files into:

   - `/usr/local/Cellar/grafana/[version]` (Intel Silicon)
   - `/opt/homebrew/Cellar/grafana/[version]` (Apple Silicon)

1. To start Grafana, run the following command:

   ```bash
   brew services start grafana
   ```

## Install standalone macOS binaries

To install Grafana on macOS using the standalone binaries, complete the following steps:

1. Navigate to the [Grafana download page](https://grafana.com/grafana/download).
1. Select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only tagged releases. If you want to install a nightly build, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise:** This is the recommended version. It is functionally identical to the open source version, but includes features you can unlock with a license, if you so choose.
   - **Open Source:** This version is functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Click **Mac**.
1. Copy and paste the code from the installation page into your command line and run.
1. Untar the `gz` file and copy the files to the location of your preference.
1. To start Grafana service, go to the directory and run the command:

   ```bash
   ./bin/grafana-server
   ```

## Next steps

- [Start the Grafana server]({{< relref "../../start-restart-grafana/" >}})
