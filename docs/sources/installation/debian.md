+++
title = "Installing on Debian / Ubuntu"
description = "Install guide for Grafana"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
aliases = ["/installation/installation/debian"]
[menu.docs]
name = "Installing on Ubuntu / Debian"
identifier = "debian"
parent = "installation"
weight = 1
+++

# Installing on Debian / Ubuntu

Description | Download
------------ | -------------
Stable for Debian-based Linux | [x86-64](https://grafana.com/grafana/download?platform=linux)
Stable for Debian-based Linux | [ARM64](https://grafana.com/grafana/download?platform=arm)
Stable for Debian-based Linux | [ARMv7](https://grafana.com/grafana/download?platform=arm)

Read [Upgrading Grafana]({{< relref "installation/upgrading.md" >}}) for tips and guidance on updating an existing
installation.

## Install Stable


```bash
wget <debian package url>
sudo apt-get install -y adduser libfontconfig
sudo dpkg -i grafana_5.1.4_amd64.deb
```

Example:

```bash
wget https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana_5.1.4_amd64.deb
sudo apt-get install -y adduser libfontconfig
sudo dpkg -i grafana_5.1.4_amd64.deb
```

## APT Repository

Add the following line to your `/etc/apt/sources.list` file.

```bash
deb https://packagecloud.io/grafana/stable/debian/ stretch main
```

Use the above line even if you are on Ubuntu or another Debian version.
There is also a testing repository if you want beta or release
candidates.

```bash
deb https://packagecloud.io/grafana/testing/debian/ stretch main
```

Then add the [Package Cloud](https://packagecloud.io/grafana) key. This
allows you to install signed packages.

```bash
curl https://packagecloud.io/gpg.key | sudo apt-key add -
```

Update your Apt repositories and install Grafana

```bash
sudo apt-get update
sudo apt-get install grafana
```

On some older versions of Ubuntu and Debian you may need to install the
`apt-transport-https` package which is needed to fetch packages over
HTTPS.

```bash
sudo apt-get install -y apt-transport-https
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

## Start the server (init.d service)

Start Grafana by running:

```bash
sudo service grafana-server start
```

This will start the `grafana-server` process as the `grafana` user,
which was created during the package installation. The default HTTP port
is `3000` and default user and group is `admin`.

To configure the Grafana server to start at boot time:

```bash
sudo update-rc.d grafana-server defaults
```

## Start the server (via systemd)

To start the service using systemd:

```bash
systemctl daemon-reload
systemctl start grafana-server
systemctl status grafana-server
```

Enable the systemd service so that Grafana starts at boot.

```bash
sudo systemctl enable grafana-server.service
```

## Environment file

The systemd service file and init.d script both use the file located at
`/etc/default/grafana-server` for environment variables used when
starting the back-end. Here you can override log directory, data
directory and other variables.

### Logging

By default Grafana will log to `/var/log/grafana`

### Database

The default configuration specifies a sqlite3 database located at
`/var/lib/grafana/grafana.db`. Please backup this database before
upgrades. You can also use MySQL or Postgres as the Grafana database, as detailed on [the configuration page]({{< relref "configuration.md#database" >}}).

## Configuration

The configuration file is located at `/etc/grafana/grafana.ini`.  Go the
[Configuration]({{< relref "configuration.md" >}}) page for details on all
those options.

### Adding data sources

- [Graphite]({{< relref "features/datasources/graphite.md" >}})
- [InfluxDB]({{< relref "features/datasources/influxdb.md" >}})
- [OpenTSDB]({{< relref "features/datasources/opentsdb.md" >}})
- [Prometheus]({{< relref "features/datasources/prometheus.md" >}})

## Installing from binary tar file

Download [the latest `.tar.gz` file](https://grafana.com/get) and
extract it.  This will extract into a folder named after the version you
downloaded. This folder contains all files required to run Grafana.  There are
no init scripts or install scripts in this package.

To configure Grafana add a configuration file named `custom.ini` to the
`conf` folder and override any of the settings defined in
`conf/defaults.ini`.

Start Grafana by executing `./bin/grafana-server web`. The `grafana-server`
binary needs the working directory to be the root install directory (where the
binary and the `public` folder is located).
