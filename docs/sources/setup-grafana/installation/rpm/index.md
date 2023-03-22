---
aliases:
  - ../../installation/installation/rpm/
  - ../../installation/rpm/
description: Grafana Installation guide for RPM-based Linux, such as Centos, Fedora,
  OpenSuse, and Red Hat.
title: Install on RPM-based Linux
weight: 400
---

# Install on Redhat, RHEL, or Fedora

This topic explains how to install Grafana dependencies, install Grafana on Redhat, RHEL, or Fedora, and start the Grafana server on your system.

You can install Grafana using a YUM repository, using RPM, or by downloading a binary `.tar.gz` file.

If you install via the `.tar.gz` file, then you must manually update Grafana for each new version.

## Install Grafana using YUM

You can install Grafana from a YUM repository or manually using YUM.

### Install from YUM repository

If you install from the YUM repository, then Grafana is automatically updated every time you run `sudo yum update`.

| Grafana Version    | Package            | Repository                |
| ------------------ | ------------------ | ------------------------- |
| Grafana Enterprise | grafana-enterprise | `https://rpm.grafana.com` |
| Grafana OSS        | grafana            | `https://rpm.grafana.com` |

> **Note:** Grafana Enterprise is the recommended and default edition. It is available for free and includes all the features of the OSS edition. You can also upgrade to the [full Enterprise feature set](https://grafana.com/products/enterprise/?utm_source=grafana-install-page), which has support for [Enterprise plugins](https://grafana.com/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).

To install Grafana using a YUM repository, complete the following steps:

1. Add a new file to your YUM repo using the method of your choice.

   The following example uses `nano`.

   ```bash
   sudo nano /etc/yum.repos.d/grafana.repo
   ```

   ```bash
   [grafana]
   name=grafana
   baseurl=https://rpm.grafana.com
   repo_gpgcheck=1
   enabled=1
   gpgcheck=1
   gpgkey=https://rpm.grafana.com/gpg.key
   sslverify=1
   sslcacert=/etc/pki/tls/certs/ca-bundle.crt
   ```

1. To prevent beta versions from being installed, add the following exclude line to your `.repo` file.

   ```bash
   exclude=*beta*
   ```

1. To install Grafana OSS, run the following command:

   ```bash
   sudo yum install grafana
   ```

1. To install Grafana Enterprise, run the following command:

   ```bash
   sudo yum install grafana-enterprise
   ```

### Install manually using YUM

If you install Grafana manually using YUM, then you must manually update Grafana for each new version. The following steps enable automatic updates for your Grafana installation.

1. Navigate to the [Grafana download page](https://grafana.com/grafana/download).
1. Select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only tagged releases. If you want to install a nightly build, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise:** This is the recommended version. It is functionally identical to the open source version, but includes features you can unlock with a license, if you so choose.
   - **Open Source:** This version is functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Depending on which system you are running, click the **Linux** or **ARM** tab on the download page.
1. Copy and paste the code from the installation page into your command line and run.

### Install Grafana using RPM

If you install Grafana using RPM, then you must manually update Grafana for each new version. This method varies according to which Linux OS you are running. Read the instructions fully before you begin.

**Note:** The RPM files are signed. You can verify the signature with this [public GPG key](https://rpm.grafana.com/gpg.key).

1. On the [Grafana download page](https://grafana.com/grafana/download), select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only finished releases. If you want to install a beta version, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise** - Recommended download. Functionally identical to the open source version, but includes features you can unlock with a license if you so choose.
   - **Open Source** - Functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Depending on which system you are running, click **Linux** or **ARM**.
1. Copy and paste the RPM package URL and the local RPM package information from the installation page into the pattern shown below, then run the commands.

   ```bash
   sudo yum install initscripts urw-fonts wget
   wget <rpm package url>
   sudo rpm -Uvh <local rpm package>
   ```

### Install Grafana using the binary .tar.gz file

Download the latest [`.tar.gz` file](https://grafana.com/grafana/download?platform=linux) and extract it. The files are extracted into a folder named after the Grafana version that you downloaded. This folder contains all files required to run Grafana. There are no init scripts or install scripts in this package.

1. Navigate to the [Grafana download page](https://grafana.com/grafana/download).
1. Select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only tagged releases. If you want to install a nightly build, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise:** This is the recommended version. It is functionally identical to the open-source version but includes features you can unlock with a license if you so choose.
   - **Open Source:** This version is functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Depending on which system you are running, click the **Linux** or **ARM** tab on the download page.
1. Copy and paste the code from the installation page into your command line and run.

```bash
wget <tar.gz package url>
sudo tar -zxvf <tar.gz package>
```

## 2. Start the server

This starts the `grafana-server` process as the `grafana` user, which was created during the package installation. The systemd commands work in most cases, but some older Linux systems might require init.d. The installer should prompt you with the correct commands.

If you installed with an `.rpm` package, then you can start the server using `systemd` or `init.d`. If you installed a binary `.tar.gz` file, then you need to execute the binary.

### Start the server with systemd

To start the service and verify that the service has started:

```bash
sudo systemctl daemon-reload
sudo systemctl start grafana-server
sudo systemctl status grafana-server
```

Configure the Grafana server to start at boot:

```bash
sudo systemctl enable grafana-server
```

> **SUSE or OpenSUSE users:** You might need to start the server with the systemd method, then use the init.d method to configure Grafana to start at boot.

#### Serving Grafana on a port < 1024

{{< docs/shared "systemd/bind-net-capabilities.md" >}}

#### Serving Grafana behind a proxy

When serving Grafana behind a proxy, you need to configure the `http_proxy` and `https_proxy` environment variables.

### Start the server with init.d

To start the service and verify that the service has started:

```bash
sudo service grafana-server start
sudo service grafana-server status
```

Configure the Grafana server to start at boot:

```bash
sudo /sbin/chkconfig --add grafana-server
```

### Execute the binary

The `grafana-server` binary needs the working directory to be the root install directory where the binary and the `public` folder are located.

Start Grafana by running:

```bash
./bin/grafana-server web
```

## Next steps

Refer to the [Getting Started]({{< relref "../../../getting-started/build-first-dashboard/" >}}) guide for information about logging in, setting up data sources, and so on.

## Configure Grafana

Refer to the [Configuration]({{< relref "../../configure-grafana/" >}}) page for details on options for customizing your environment, logging, database, and so on.
