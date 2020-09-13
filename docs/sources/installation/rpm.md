+++
title = "Install on RPM-based Linux"
description = "Grafana Installation guide for RPM-based Linux, such as Centos, Fedora, OpenSuse, and Red Hat."
keywords = ["grafana", "installation", "documentation", "centos", "fedora", "opensuse", "redhat"]
aliases = ["/docs/grafana/latest/installation/installation/rpm"]
type = "docs"
[menu.docs]
name = "Install on RPM-based Linux"
identifier = "rpm"
parent = "installation"
weight = 300
+++

# Install on RPM-based Linux (CentOS, Fedora, OpenSuse, Red Hat)

This page explains how to install Grafana dependencies, download and install Grafana, get the service up and running on your RPM-based Linux system, and the installation package details.

**Note on upgrading:** While the process for upgrading Grafana is very similar to installing Grafana, there are some key backup steps you should perform. Read [Upgrading Grafana]({{< relref "upgrading.md" >}}) for tips and guidance on updating an existing installation.


## 1. Download and install

You can install Grafana from a YUM repository, manually using YUM, manually using RPM, or by downloading a binary `.tar.gz` file.

### Install from YUM repository

If you install from the YUM repository, then Grafana is automatically updated every time you run `sudo yum update`.

| Grafana Version            | Package            | Repository                                         |
|----------------------------|--------------------|----------------------------------------------------|
| Grafana OSS                | grafana            | `https://packages.grafana.com/oss/rpm`             |
| Grafana OSS (Beta)         | grafana            | `https://packages.grafana.com/oss/rpm-beta`        |
| Grafana Enterprise         | grafana-enterprise | `https://packages.grafana.com/enterprise/rpm`      |
| Grafana Enterprise (Beta)  | grafana-enterprise | `https://packages.grafana.com/enterprise/rpm-beta` |


Add a new file to your YUM repo using the method of your choice. The command below uses `nano`.

```bash
sudo nano /etc/yum.repos.d/grafana.repo
```

Choose if you want to install the Open Source or Enterprise edition of Grafana and enter the information from the edition you've chosen into `grafana.repo`. If you want to install the beta version of Grafana you need to replace the URL with a beta URL from the table above.

> We recommend all users to install the Enterprise Edition of Grafana, which can be seamlessly upgraded with a Grafana Enterprise [subscription](https://grafana.com/products/enterprise/?utm_source=grafana-install-page).

For Enterprise releases:
```bash
[grafana]
name=grafana
baseurl=https://packages.grafana.com/enterprise/rpm
repo_gpgcheck=1
enabled=1
gpgcheck=1
gpgkey=https://packages.grafana.com/gpg.key
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
```

For OSS releases:
```bash
[grafana]
name=grafana
baseurl=https://packages.grafana.com/oss/rpm
repo_gpgcheck=1
enabled=1
gpgcheck=1
gpgkey=https://packages.grafana.com/gpg.key
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
```

Install Grafana with one of the following commands:

```bash
sudo yum install grafana

# or

sudo yum install grafana-enterprise
```

### Install manually with YUM

If you install manually with YUM, then you will need to manually update Grafana for each new version. To enable automatic updates for your Grafana installation please use the instructions below to install via our YUM repository.

1. On the [Grafana download page](https://grafana.com/grafana/download), select the Grafana version you want to install. 
   * The most recent Grafana version is selected by default.
   * The **Version** field displays only finished releases. If you want to install a beta version, click **Nightly Builds** and then select a version.
2. Select an **Edition**.
   * **Enterprise** - Recommended download. Functionally identical to the open source version, but includes features you can unlock with a license if you so choose.
   * **Open Source** - Functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want enterprise features.
3. Depending on which system you are running, click **Linux** or **ARM**.
4. Copy and paste the code from the installation page into your command line and run. It follows the pattern shown below.

```bash
wget <rpm package url>
sudo yum localinstall <local rpm package>
```
   You can also install Grafana using YUM directly:

```bash
sudo yum install <rpm package url>
```

### Install with RPM

If you install with RPM, then you will need to manually update Grafana for each new version. This method varies according to which Linux OS you are running. Read the instructions fully before you begin.

**Note:** The .rpm files are signed, you can verify the signature with this [public GPG key](https://packages.grafana.com/gpg.key).

1. On the [Grafana download page](https://grafana.com/grafana/download), select the Grafana version you want to install. 
   * The most recent Grafana version is selected by default.
   * The **Version** field displays only finished releases. If you want to install a beta version, click **Nightly Builds** and then select a version.
2. Select an **Edition**.
   * **Enterprise** - Recommended download. Functionally identical to the open source version, but includes features you can unlock with a license if you so choose.
   * **Open Source** - Functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
3. Depending on which system you are running, click **Linux** or **ARM**.
4. Copy and paste the .rpm package URL and the local .rpm package information from the installation page into the pattern shown below, then run the commands.

**On CentOS, Fedora, Red Hat, or RHEL:**

```bash
sudo yum install initscripts urw-fonts wget
wget <rpm package url>
sudo rpm -Uvh <local rpm package>
```

**On OpenSUSE or SUSE:**

```bash
wget <rpm package url>
sudo rpm -i --nodeps <local rpm package>
```

### Install from binary .tar.gz file

Download the latest [`.tar.gz` file](https://grafana.com/grafana/download?platform=linux) and extract it. The files are extracted into a folder named after the Grafana version that you downloaded. This folder contains all files required to run Grafana. There are no init scripts or install scripts in this package.

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

## Package details

- Installs binary to `/usr/sbin/grafana-server`
- Copies init.d script to `/etc/init.d/grafana-server`
- Installs default file (environment vars) to `/etc/sysconfig/grafana-server`
- Copies configuration file to `/etc/grafana/grafana.ini`
- Installs systemd service (if systemd is available) name `grafana-server.service`
- The default configuration uses a log file at `/var/log/grafana/grafana.log`
- The default configuration specifies an sqlite3 database at `/var/lib/grafana/grafana.db`

## Next steps

Refer to the [Getting Started]({{< relref "../getting-started/getting-started/" >}}) guide for information about logging in, setting up data sources, and so on.

## Configure Grafana

Refer to the [Configuration]({{< relref "../administration/configuration.md" >}}) page for details on options for customizing your environment, logging, database, and so on.
