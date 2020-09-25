+++
title = "Install on Debian/Ubuntu"
description = "Install guide for Grafana on Debian or Ubuntu"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
aliases = ["/docs/grafana/latest/installation/installation/debian"]
[menu.docs]
identifier = "debian"
parent = "installation"
weight = 200
+++

# Install on Debian or Ubuntu

This page explains how to install Grafana dependencies, download and install Grafana, get the service up and running on your Debian or Ubuntu system, and also describes the installation package details.

**Note on upgrading:** While the process for upgrading Grafana is very similar to installing Grafana, there are some key backup steps you should perform. Read [Upgrading Grafana]({{< relref "upgrading.md" >}}) for tips and guidance on updating an existing installation.

## 1. Download and install

You can install Grafana using our official APT repository, by downloading a `.deb` package, or by downloading a binary `.tar.gz` file.

### Install from APT repository

If you install from the APT repository, then Grafana is automatically updated every time you run `apt-get update`. 

| Grafana Version | Package | Repository |
|-----------------|---------|------------|
| Grafana OSS     | grafana | `https://packages.grafana.com/oss/deb stable main` |
| Grafana OSS (Beta)     | grafana | `https://packages.grafana.com/oss/deb beta main` |
| Grafana Enterprise     | grafana-enterprise | `https://packages.grafana.com/enterprise/deb stable main` |
| Grafana Enterprise (Beta)     | grafana-enterprise | `https://packages.grafana.com/enterprise/deb beta main` |

> We recommend all users install the Enterprise Edition of Grafana, which can be seamlessly upgraded with a Grafana Enterprise [subscription](https://grafana.com/products/enterprise/?utm_source=grafana-install-page).

#### To install the latest Enterprise edition:

```bash
sudo apt-get install -y apt-transport-https
sudo apt-get install -y software-properties-common wget
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
```

Add this repository for stable releases:

```bash
echo "deb https://packages.grafana.com/enterprise/deb stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list 
```

Add this repository if you want beta releases:
```bash
echo "deb https://packages.grafana.com/enterprise/deb beta main" | sudo tee -a /etc/apt/sources.list.d/grafana.list 
```

After you add the repository:

```bash
sudo apt-get update
sudo apt-get install grafana-enterprise
```

#### To install the latest OSS release:

```bash
sudo apt-get install -y apt-transport-https
sudo apt-get install -y software-properties-common wget
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
```

Add this repository for stable releases:

```bash
echo "deb https://packages.grafana.com/oss/deb stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list 
```

Add this repository if you want beta releases:
```bash
echo "deb https://packages.grafana.com/oss/deb beta main" | sudo tee -a /etc/apt/sources.list.d/grafana.list 
```

After you add the repository:

```bash
sudo apt-get update
sudo apt-get install grafana
```

### Install .deb package

If you install the `.deb` package, then you will need to manually update Grafana for each new version.

1. On the [Grafana download page](https://grafana.com/grafana/download), select the Grafana version you want to install. 
   * The most recent Grafana version is selected by default.
   * The **Version** field displays only finished releases. If you want to install a beta version, click **Nightly Builds** and then select a version.
1. Select an **Edition**.
   - **Enterprise** - Recommended download. Functionally identical to the open source version, but includes features you can unlock with a license if you so choose.
   - **Open Source** - Functionally identical to the Enterprise version, but you will need to download the Enterprise version if you want Enterprise features.
1. Depending on which system you are running, click **Linux** or **ARM**.
1. Copy and paste the code from the installation page into your command line and run. It follows the pattern shown below.

```bash
sudo apt-get install -y adduser libfontconfig1
wget <.deb package url>
sudo dpkg -i grafana<edition>_<version>_amd64.deb
```

## Install from binary .tar.gz file

Download the latest [`.tar.gz` file](https://grafana.com/grafana/download?platform=linux) and extract it. The files extract into a folder named after the Grafana version downloaded. This folder contains all files required to run Grafana. There are no init scripts or install scripts in this package.

```bash
wget <tar.gz package url>
sudo tar -zxvf <tar.gz package>
```

## 2. Start the server

This starts the `grafana-server` process as the `grafana` user, which was created during the package installation.

If you installed with the APT repository or `.deb` package, then you can start the server using `systemd` or `init.d`. If you installed a binary `.tar.gz` file, then you need to execute the binary.

### Start the server with systemd

To start the service and verify that the service has started:

```bash
sudo systemctl daemon-reload
sudo systemctl start grafana-server
sudo systemctl status grafana-server
```

Configure the Grafana server to start at boot:

```bash
sudo systemctl enable grafana-server.service
```

### Start the server with init.d

To start the service and verify that the service has started:

```bash
sudo service grafana-server start
sudo service grafana-server status
```

Configure the Grafana server to start at boot:

```bash
sudo update-rc.d grafana-server defaults
```

### Execute the binary

The `grafana-server` binary .tar.gz needs the working directory to be the root install directory where the binary and the `public` folder are located.

Start Grafana by running: 
```bash
./bin/grafana-server web
```

## Package details

- Installs binary to `/usr/sbin/grafana-server`
- Installs Init.d script to `/etc/init.d/grafana-server`
- Creates default file (environment vars) to `/etc/default/grafana-server`
- Installs configuration file to `/etc/grafana/grafana.ini`
- Installs systemd service (if systemd is available) name `grafana-server.service`
- The default configuration sets the log file at `/var/log/grafana/grafana.log`
- The default configuration specifies a SQLite3 db at `/var/lib/grafana/grafana.db`
- Installs HTML/JS/CSS and other Grafana files at `/usr/share/grafana`

## Next steps

Refer to the [Getting Started]({{< relref "../getting-started/getting-started/" >}}) guide for information about logging in, setting up data sources, and so on.

## Configure Grafana

Refer to the [Configuration]({{< relref "../administration/configuration.md" >}}) page for details on options for customizing your environment, logging, database, and so on.
