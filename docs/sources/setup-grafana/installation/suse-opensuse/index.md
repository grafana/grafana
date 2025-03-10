---
description: Install guide for Grafana on SUSE or openSUSE.
labels:
  products:
    - enterprise
    - oss
menuTitle: SUSE or openSUSE
title: Install Grafana on SUSE or openSUSE
weight: 300
---

# Install Grafana on SUSE or openSUSE

This topic explains how to install Grafana dependencies, install Grafana on SUSE or openSUSE and start the Grafana server on your system.

You can install Grafana using the RPM repository, or by downloading a binary `.tar.gz` file.

If you install via RPM or the `.tar.gz` file, then you must manually update Grafana for each new version.

The following video demonstrates how to install Grafana on SUSE or openSUSE as outlined in this document:

{{< youtube id="2MWsu0xy5Xc" >}}

## Install Grafana from the RPM repository

If you install from the RPM repository, then Grafana is automatically updated every time you run `sudo zypper update`.

| Grafana Version    | Package            | Repository                |
| ------------------ | ------------------ | ------------------------- |
| Grafana Enterprise | grafana-enterprise | `https://rpm.grafana.com` |
| Grafana OSS        | grafana            | `https://rpm.grafana.com` |

{{< admonition type="note" >}}
Grafana Enterprise is the recommended and default edition. It is available for free and includes all the features of the OSS edition. You can also upgrade to the [full Enterprise feature set](/products/enterprise/?utm_source=grafana-install-page), which has support for [Enterprise plugins](/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).
{{< /admonition >}}

To install Grafana using the RPM repository, complete the following steps:

1. Import the GPG key:

   ```bash
   wget -q -O gpg.key https://rpm.grafana.com/gpg.key
   sudo rpm --import gpg.key
   ```

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

If you install Grafana manually using RPM, then you must manually update Grafana for each new version. This method varies according to which Linux OS you are running.

**Note:** The RPM files are signed. You can verify the signature with this [public GPG key](https://rpm.grafana.com/gpg.key).

1. On the [Grafana download page](/grafana/download), select the Grafana version you want to install.
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

If you install Grafana manually using the standalone binaries, then you must manually update Grafana for each new version.

Complete the following steps to install Grafana using the standalone binaries:

1. Navigate to the [Grafana download page](/grafana/download).
1. Select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only tagged releases. If you want to install a nightly build, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise:** This is the recommended version. It is functionally identical to the open source version but includes features you can unlock with a license if you so choose.
   - **Open Source:** This version is functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Depending on which system you are running, click the **Linux** or **ARM** tab on the [download page](/grafana/download).
1. Copy and paste the code from the [download page](/grafana/download) into your command line and run.
1. Create a user account for Grafana on your system:

   ```shell
   sudo useradd -r -s /bin/false grafana
   ```

1. Move the unpacked binary to `/usr/local/grafana`:

   ```shell
   sudo mv <DOWNLOAD PATH> /usr/local/grafana
   ```

1. Change the owner of `/usr/local/grafana` to Grafana users:

   ```shell
   sudo chown -R grafana:users /usr/local/grafana
   ```

1. Create a Grafana server systemd unit file:

   ```shell
   sudo touch /etc/systemd/system/grafana-server.service
   ```

1. Add the following to the unit file in a text editor of your choice:

   ```ini
   [Unit]
   Description=Grafana Server
   After=network.target

   [Service]
   Type=simple
   User=grafana
   Group=users
   ExecStart=/usr/local/grafana/bin/grafana server --config=/usr/local/grafana/conf/grafana.ini --homepath=/usr/local/grafana
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

1. Use the binary to manually start the Grafana server:

   ```shell
   /usr/local/grafana/bin/grafana-server --homepath /usr/local/grafana
   ```

   {{< admonition type="note" >}}
   Manually invoking the binary in this step automatically creates the `/usr/local/grafana/data` directory, which needs to be created and configured before the installation can be considered complete.
   {{< /admonition >}}

1. Press `CTRL+C` to stop the Grafana server.
1. Change the owner of `/usr/local/grafana` to Grafana users again to apply the ownership to the newly created `/usr/local/grafana/data` directory:

   ```shell
   sudo chown -R grafana:users /usr/local/grafana
   ```

1. [Configure the Grafana server to start at boot time using systemd](https://grafana.com/docs/grafana/latest/setup-grafana/start-restart-grafana/#configure-the-grafana-server-to-start-at-boot-using-systemd).

## Uninstall on SUSE or openSUSE

To uninstall Grafana, run the following commands in a terminal window:

1. If you configured Grafana to run with systemd, stop the systemd service for Grafana server:

   ```shell
   sudo systemctl stop grafana-server
   ```

1. If you configured Grafana to run with init.d, stop the init.d service for Grafana server:

   ```shell
   sudo service grafana-server stop
   ```

1. To uninstall Grafana OSS:

   ```shell
   sudo zypper remove grafana
   ```

1. To uninstall Grafana Enterprise:

   ```shell
   sudo zypper remove grafana-enterprise
   ```

1. Optional: To remove the Grafana repository:

   ```shell
   sudo zypper removerepo grafana
   ```

## Next steps

Refer to [Start the Grafana server]({{< relref "../../start-restart-grafana" >}}).
