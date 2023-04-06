---
description: Install guide for Grafana on Red Hat, RHEL, and Fedora.
title: Install Grafana on Red Hat, RHEL, or Fedora
menuTitle: Redhat, RHEL, or Fedora
weight: 400
---

# Install Grafana on Red Hat, RHEL, or Fedora

This topic explains how to install Grafana dependencies, install Grafana on Redhat, RHEL, or Fedora, and start the Grafana server on your system.

You can install Grafana using a YUM repository, using RPM, or by downloading a binary `.tar.gz` file.

If you install via RPM or the `.tar.gz` file, then you must manually update Grafana for each new version.

## Install Grafana from the YUM repository

If you install from the YUM repository, then Grafana is automatically updated every time you run `sudo yum update`.

| Grafana Version    | Package            | Repository                |
| ------------------ | ------------------ | ------------------------- |
| Grafana Enterprise | grafana-enterprise | `https://rpm.grafana.com` |
| Grafana OSS        | grafana            | `https://rpm.grafana.com` |

> **Note:** Grafana Enterprise is the recommended and default edition. It is available for free and includes all the features of the OSS edition. You can also upgrade to the [full Enterprise feature set](https://grafana.com/products/enterprise/?utm_source=grafana-install-page), which has support for [Enterprise plugins](https://grafana.com/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).

To install Grafana using a YUM repository, complete the following steps:

1. Add a file to your YUM repository using the method of your choice.

   The following example uses `nano` to add a file to the YUM repo.

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

## Install the Grafana RPM package manually

If you install Grafana manually using YUM or RPM, then you must manually update Grafana for each new version. This method varies according to which Linux OS you are running.

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
   sudo yum install -y <rpm package url>
   ```

## Install Grafana as a standalone binary

Complete the following steps to install Grafana using the standalone binaries:

1. Navigate to the [Grafana download page](https://grafana.com/grafana/download).
1. Select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only tagged releases. If you want to install a nightly build, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise:** This is the recommended version. It is functionally identical to the open-source version but includes features you can unlock with a license if you so choose.
   - **Open Source:** This version is functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Depending on which system you are running, click the **Linux** or **ARM** tab on the download page.
1. Copy and paste the code from the installation page into your command line and run.

## Next steps

Refer to [Start the Grafana server]({{< relref "../start-restart-grafana/" >}}).
