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

## 2. Start the server

The following sections provide instructions for starting the `grafana-server` process as the `grafana` user, which was created during the package installation.

If you installed with the APT repository or `.deb` package, then you can start the server using `systemd` or `init.d`. If you installed a binary `.tar.gz` file, then you need to execute the binary.

> **Note:** The following subsections describe three methods of starting the Grafana server: with systemd, initd, or by directly running the binary. You should follow only one set of instructions, depending on how your machine is configured.

### Start the Grafana server with systemd

Complete the following steps to start the Grafana server with systemd and verify that it is running:

1. To start the service, run the following commands:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start grafana-server
   sudo systemctl status grafana-server
   ```

1. To verify that the service is running, run the following command:

   ```
   sudo systemctl status grafana-server
   ```

1. To configure the Grafana server to start at boot, run the following command:

   ```bash
   sudo systemctl enable grafana-server.service
   ```

#### Serve Grafana on a port < 1024

{{< docs/shared "systemd/bind-net-capabilities.md" >}}

### Start the server with init.d

Complete the following steps to start the Grafana service and verify that it is running:

1. To start the Grafana server, run the following commands:

   ```bash
   sudo service grafana-server start
   sudo service grafana-server status
   ```

1. To verify that the service is running, run the following command:

   ```
   sudo service grafana-server status
   ```

1. To configure the Grafana server to start at boot, run the following command:

   ```bash
   sudo update-rc.d grafana-server defaults
   ```

### Start the server using the binary

The `grafana-server` binary .tar.gz needs the working directory to be the root install directory where the binary and the `public` folder are located.

To start the Grafana server, run the following command:

```bash
./bin/grafana-server
```

## Upgrade Grafana

While the process for upgrading Grafana is similar to installing Grafana, there are important backup tasks you should perform. Refer to [Upgrade Grafana]({{< relref "../../../upgrade-guide/" >}}) for guidance on updating an existing installation.

## Next steps

- [Start the Grafana server]({{< relref "../../start-restart-grafana/" >}})
