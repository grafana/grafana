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

You can install Grafana directly using Yum, via Yum repository, or by downloading a binary `.tar.gz` file.


You can install Grafana using Yum directly:

```bash
sudo yum install <rpm package url>
```

You will find package URLs on the [download page](https://grafana.com/grafana/download?platform=linux).

Or install manually using `rpm`. First execute

```bash
wget <rpm package url>
```

### On CentOS / Fedora / Redhat:

```bash
sudo yum install initscripts urw-fonts
sudo rpm -Uvh <local rpm package>
```

### On OpenSuse:

```bash
sudo rpm -i --nodeps <local rpm package>
```

## Install via YUM Repository

Add the following to a new file at `/etc/yum.repos.d/grafana.repo`

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

There is a separate repository if you want beta releases.

```bash
[grafana]
name=grafana
baseurl=https://packages.grafana.com/oss/rpm-beta
repo_gpgcheck=1
enabled=1
gpgcheck=1
gpgkey=https://packages.grafana.com/gpg.key
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
```

Then install Grafana via the `yum` command.

```bash
sudo yum install grafana
```

### RPM GPG Key

The RPMs are signed, you can verify the signature with this [public GPG key](https://packages.grafana.com/gpg.key).

## Package details

- Installs binary to `/usr/sbin/grafana-server`
- Copies init.d script to `/etc/init.d/grafana-server`
- Installs default file (environment vars) to `/etc/sysconfig/grafana-server`
- Copies configuration file to `/etc/grafana/grafana.ini`
- Installs systemd service (if systemd is available) name `grafana-server.service`
- The default configuration uses a log file at `/var/log/grafana/grafana.log`
- The default configuration specifies an sqlite3 database at `/var/lib/grafana/grafana.db`



## 2. Start the server

This starts the `grafana-server` process as the `grafana` user, which was created during the package installation.

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
sudo systemctl enable grafana-server.service
```
### Start the server with init.d

You can start Grafana by running:

```bash
sudo service grafana-server start
```


Configure the Grafana server to start at boot

```bash
$ sudo /sbin/chkconfig --add grafana-server
```


### Execute the binary

The `grafana-server` binary needs the working directory to be the root install directory where the binary and the `public` folder are located.

Start Grafana by running: 
```bash
./bin/grafana-server web
```

## Next steps

Refer to the [Getting Started]({{< relref "../guides/getting_started/" >}}) guide for information about logging in, setting up data sources, and so on.

## Configure Grafana

Refer the [Configuration]({{< relref "configuration.md" >}}) page for details on options for customizing your environment, logging, database, and so on.