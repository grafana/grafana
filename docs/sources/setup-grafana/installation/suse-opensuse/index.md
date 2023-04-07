---
description: Install guide for Grafana on SUSE or OpenSUSE.
title: Install Grafana on SUSE or OpenSUSE
menuTitle: Redhat, RHEL, or Fedora
weight: 450
---

# Install Grafana on SUSE or OpenSUSE

This topic explains how to install Grafana dependencies, install Grafana on SUSE or OpenSUSE and start the Grafana server on your system.

You can install Grafana using a YUM repository, using RPM, or by downloading a binary `.tar.gz` file.

If you install via RPM or the `.tar.gz` file, then you must manually update Grafana for each new version.

## Install Grafana from the YUM repository

If you install from the YUM repository, then Grafana is automatically updated every time you run `sudo zypper update`.

| Grafana Version    | Package            | Repository                |
| ------------------ | ------------------ | ------------------------- |
| Grafana Enterprise | grafana-enterprise | `https://rpm.grafana.com` |
| Grafana OSS        | grafana            | `https://rpm.grafana.com` |

> **Note:** Grafana Enterprise is the recommended and default edition. It is available for free and includes all the features of the OSS edition. You can also upgrade to the [full Enterprise feature set](https://grafana.com/products/enterprise/?utm_source=grafana-install-page), which has support for [Enterprise plugins](https://grafana.com/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).

To install Grafana using a YUM repository, complete the following steps:

1. Use zypper to add the grafana repo.

   ```bash
   sudo zypper addrepo https://rpm.grafana.com grafana
   ```

1. To install Grafana OSS, run the following command:

   ```bash
   sudo zypper install grafana
   ```

1. To install Grafana Enterprise, run the following command:

   ```bash
   sudo zypper install grafana-enterprise
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
   sudo zypper install initscripts urw-fonts wget
   wget <rpm package url>
   sudo rpm -Uvh <local rpm package>
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

Refer to [Start the Grafana server]({{< relref "../../start-restart-grafana/" >}}).
