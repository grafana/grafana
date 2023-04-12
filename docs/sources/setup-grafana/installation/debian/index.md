---
aliases:
  - ../../installation/debian/
  - ../../installation/installation/debian/
description: Install guide for Grafana on Debian or Ubuntu
title: Install Grafana on Debian or Ubuntu
menutitle: Debian or Ubuntu
weight: 100
---

# Install Grafana on Debian or Ubuntu

This topic explains how to install Grafana dependencies, install Grafana on Linux Debian or Ubuntu, and start the Grafana server on your Debian or Ubuntu system.

There are multiple ways to install Grafana: using the Grafana Labs APT repository, by downloading a `.deb` package, or by downloading a binary `.tar.gz` file. Choose only one of the methods below that best suits your needs.

> **Note:** If you install via the `.deb` package or `.tar.gz` file, then you must manually update Grafana for each new version.

## Install from APT repository

If you install from the APT repository, Grafana automatically updates when you run `apt-get update`.

| Grafana Version           | Package            | Repository                            |
| ------------------------- | ------------------ | ------------------------------------- |
| Grafana Enterprise        | grafana-enterprise | `https://apt.grafana.com stable main` |
| Grafana Enterprise (Beta) | grafana-enterprise | `https://apt.grafana.com beta main`   |
| Grafana OSS               | grafana            | `https://apt.grafana.com stable main` |
| Grafana OSS (Beta)        | grafana            | `https://apt.grafana.com beta main`   |

> **Note:** Grafana Enterprise is the recommended and default edition. It is available for free and includes all the features of the OSS edition. You can also upgrade to the [full Enterprise feature set](https://grafana.com/products/enterprise/?utm_source=grafana-install-page), which has support for [Enterprise plugins](https://grafana.com/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).

Complete the following steps to install Grafana from the APT repository:

1. To install required packages and download the Grafana repository signing key, run the following commands:

   ```bash
   sudo apt-get install -y apt-transport-https
   sudo apt-get install -y software-properties-common wget
   sudo wget -q -O /usr/share/keyrings/grafana.key https://apt.grafana.com/gpg.key
   ```

1. To add a repository for stable releases, run the following command:

   ```bash
   echo "deb [signed-by=/usr/share/keyrings/grafana.key] https://apt.grafana.com stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list
   ```

1. To add a repository for beta releases, run the following command:

   ```bash
   echo "deb [signed-by=/usr/share/keyrings/grafana.key] https://apt.grafana.com beta main" | sudo tee -a /etc/apt/sources.list.d/grafana.list
   ```

1. After you add the repository, run the following commands to install the OSS or Enterprise release:

   ```bash
   # Update the list of available packages
   sudo apt-get update

   # Install the latest OSS release:
   sudo apt-get install grafana

   # Install the latest Enterprise release:
   sudo apt-get install grafana-enterprise
   ```

## Install Grafana using a deb package or as a standalone binary

If you choose not to install Grafana using APT, you can download and install Grafana using the deb package or as a standalone binary.

Complete the following steps to install Grafana using DEB or the standalone binaries:

1. Navigate to the [Grafana download page](https://grafana.com/grafana/download).
1. Select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only tagged releases. If you want to install a nightly build, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise:** This is the recommended version. It is functionally identical to the open source version, but includes features you can unlock with a license, if you so choose.
   - **Open Source:** This version is functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Depending on which system you are running, click the **Linux** or **ARM** tab on the download page.
1. Copy and paste the code from the installation page into your command line and run.

## Next steps

- [Start the Grafana server]({{< relref "../../start-restart-grafana/" >}})
