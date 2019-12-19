+++
title = "Install on Debian/Ubuntu"
description = "Install guide for Grafana on Debian or Ubuntu"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
aliases = ["/installation/installation/debian"]
[menu.docs]
name = "Install on Ubuntu/Debian"
identifier = "debian"
parent = "installation"
weight = 200
+++

# Install on Debian or Ubuntu

This page explains how to install Grafana dependencies, download and install Grafana, get the service up and running on your system, and the package details.

**Note on upgrading:** While the process for upgrading Grafana is very similar to installing Grafana, there are some key backup steps you should perform. Read [Upgrading Grafana]({{< relref "installation/upgrading.md" >}}) for tips and guidance on updating an existing installation.

## 1. Download and install

We recommend that you run all the listed commands before you download and install Grafana. They might not be necessary on all systems, but if you run them first then you will not be interrupted by dependency errors.

You can install Grafana using our official APT repository, by downloading a `.deb` package, or by using a binary `.tar.gz` file.

### Install from APT repository 

On some older versions of Ubuntu and Debian you may need to install the `apt-transport-https` package which is needed to fetch packages over HTTPS.

```bash
sudo apt-get install -y apt-transport-https
```

Install any missing dependencies:

```bash
sudo apt-get install -y software-properties-common wget
```

Add our GPG key to install signed packages:

```bash
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
```

Add this repository for stable releases:

```bash
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
```

Add this repository if you want beta releases:

```bash
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb beta main"
```

Update your APT repositories and install Grafana:

```bash
sudo apt-get update
sudo apt-get install grafana
```

### Install .deb package

Go to the [Linux download page](https://grafana.com/grafana/download?platform=linux) for the latest download links.

If you use ARM, then use the [ARM download page](https://grafana.com/grafana/download?platform=arm) for the latest download links.

```bash
sudo wget <.deb package url>
sudo apt-get install -y adduser libfontconfig1
sudo dpkg -i grafana_<version>_amd64.deb
```

## Install from binary .tar.gz file

Download the latest [`.tar.gz` file](https://grafana.com/grafana/download?platform=linux) and extract it. The files extract into a folder named after the Grafana version that you downloaded. This folder contains all files required to run Grafana. There are no init scripts or install scripts in this package.

```bash
sudo wget <tar.gz package url>
sudo apt-get install -y adduser libfontconfig1
sudo tar -zxvf <tar.gz package>
```

## 2. Start the server

This starts the `grafana-server` process as the `grafana` user, which was created during the package installation.

If you installed with the APT repository or `.deb` package, then you can start the server using `systemd` or `init.d`. If you installed a binary `.tar.gz` file, then you need to execute the binary.

### Start the server with systemd

To start the service using systemd:

```bash
sudo systemctl daemon-reload
sudo systemctl start grafana-server
```

Verify that the service has started:

```bash
sudo systemctl status grafana-server
```

Enable the systemd service so that Grafana starts at boot:

```bash
sudo systemctl enable grafana-server.service
```

### Start the server with init.d

Start Grafana by running:

```bash
sudo service grafana-server start
```

Verify that the service has started:

```bash
sudo service grafana-server status
```

Configure the Grafana server to start at boot:

```bash
sudo update-rc.d grafana-server defaults
```

### Execute the binary

The `grafana-server` binary needs the working directory to be the root install directory where the binary and the `public` folder are located.

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
- The default configuration specifies an sqlite3 db at `/var/lib/grafana/grafana.db`
- Installs HTML/JS/CSS and other Grafana files at `/usr/share/grafana`

## Next steps

Refer to the [Getting Started](/guides/getting_started/) guide for information about logging in, setting up data sources, and so on.

## Configure Grafana

Refer the [Configuration]({{< relref "configuration.md" >}}) page for details on options for customizing your environment, logging, database, and so on.

