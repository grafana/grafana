---
description: Install guide for Grafana on RHEL and Fedora.
labels:
  products:
    - enterprise
    - oss
menuTitle: RHEL or Fedora
title: Install Grafana on RHEL or Fedora
weight: 200
---

# Install Grafana on RHEL or Fedora

This topic explains how to install Grafana dependencies, install Grafana on RHEL or Fedora, and start the Grafana server on your system.

You can install Grafana from the RPM repository, from standalone RPM, or with the binary `.tar.gz` file.

If you install via RPM or the `.tar.gz` file, then you must manually update Grafana for each new version.

The following video demonstrates how to install Grafana on RHEL or Fedora as outlined in this document:

{{< youtube id="4khbLlyoqzE" >}}

## Install Grafana from the RPM repository

If you install from the RPM repository, then Grafana is automatically updated every time you update your applications.

| Grafana Version           | Package            | Repository                     |
| ------------------------- | ------------------ | ------------------------------ |
| Grafana Enterprise        | grafana-enterprise | `https://rpm.grafana.com`      |
| Grafana Enterprise (Beta) | grafana-enterprise | `https://rpm-beta.grafana.com` |
| Grafana OSS               | grafana            | `https://rpm.grafana.com`      |
| Grafana OSS (Beta)        | grafana            | `https://rpm-beta.grafana.com` |

{{< admonition type="note" >}}
Grafana Enterprise is the recommended and default edition. It is available for free and includes all the features of the OSS edition. You can also upgrade to the [full Enterprise feature set](/products/enterprise/?utm_source=grafana-install-page), which has support for [Enterprise plugins](/grafana/plugins/?enterprise=1&utcm_source=grafana-install-page).
{{< /admonition >}}

To install Grafana from the RPM repository, complete the following steps:

{{< admonition type="note" >}}
If you wish to install beta versions of Grafana, substitute the repository URL for the beta URL listed above.
{{< /admonition >}}

1. Import the GPG key:

   ```bash
   wget -q -O gpg.key https://rpm.grafana.com/gpg.key
   sudo rpm --import gpg.key
   ```

1. Create `/etc/yum.repos.d/grafana.repo` with the following content:

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

1. To install Grafana OSS, run the following command:

   ```bash
   sudo dnf install grafana
   ```

1. To install Grafana Enterprise, run the following command:

   ```bash
   sudo dnf install grafana-enterprise
   ```

## Install the Grafana RPM package manually

If you install Grafana manually using YUM or RPM, then you must manually update Grafana for each new version. This method varies according to which Linux OS you are running.

**Note:** The RPM files are signed. You can verify the signature with this [public GPG key](https://rpm.grafana.com/gpg.key).

1. On the [Grafana download page](/grafana/download), select the Grafana version you want to install.
   - The most recent Grafana version is selected by default.
   - The **Version** field displays only finished releases. If you want to install a beta version, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise** - Recommended download. Functionally identical to the open source version, but includes features you can unlock with a license if you so choose.
   - **Open Source** - Functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Depending on which system you are running, click **Linux** or **ARM**.
1. Copy and paste the RPM package URL and the local RPM package information from the [download page](/grafana/download) into the pattern shown below and run the command.

   ```bash
   sudo yum install -y <rpm package url>
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
1. Copy and paste the code from the [download page](/grafana/download) page into your command line and run.
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

1. [Configure the Grafana server to start at boot time using systemd]({{< relref "../../start-restart-grafana#configure-the-grafana-server-to-start-at-boot-using-systemd" >}}).

## Uninstall on RHEL or Fedora

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
   sudo dnf remove grafana
   ```

1. To uninstall Grafana Enterprise:

   ```shell
   sudo dnf remove grafana-enterprise
   ```

1. Optional: To remove the Grafana repository:

   ```shell
   sudo rm -i /etc/yum.repos.d/grafana.repo
   ```

## Next steps

Refer to [Start the Grafana server]({{< relref "../../start-restart-grafana" >}}).
