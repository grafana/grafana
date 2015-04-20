---
page_title: Installing on Debian / Ubuntu
page_description: Grafana Installation guide for Debian / Ubuntu.
page_keywords: grafana, installation, debian, ubuntu, guide
---

# Installing on Debian / Ubuntu

## Download

Description | Download
------------ | -------------
.deb for Debian-based Linux | [grafana_2.0.1_amd64.deb](https://grafanarel.s3.amazonaws.com/builds/grafana_2.0.1_amd64.deb)

## Install

    $ wget https://grafanarel.s3.amazonaws.com/builds/grafana_2.0.1_amd64.deb
    $ sudo apt-get install -y adduser libfontconfig
    $ sudo dpkg -i grafana_2.0.1_amd64.deb

## APT Repository
Add the following line to your `/etc/apt/sources.list`

    deb https://packagecloud.io/grafana/stable/debian/ wheezy main

Use the above line even if you are on Ubuntu or another debian version. There is also testing
repository if you want beta or release candidates.

    deb https://packagecloud.io/grafana/testing/debian/ wheezy main

Then add the [Package Cloud](https://packagecloud.io/grafana) key used to sign packages.

    $ curl https://packagecloud.io/gpg.key | sudo apt-key add -

Update apt and install Grafana

    $ sudo apt-get update
    $ sudo apt-get install grafana

On some older versions of Ubuntu and Debian you may need to install `apt-transport-https`,
needed to fetch packages over HTTPS.

    $ sudo apt-get install -y apt-transport-https

## Package details

- Installs binary to `/usr/sbin/grafana-server`
- Init.d script to `/etc/init.d/grafana-server`
- Default file (environment vars) to `/etc/default/grafana-server`
- Configuration file to `/etc/grafana/grafana.ini`
- Systemd service (if systemd is available) name `grafana-server.service`
- The default configuration specifies log file at `/var/log/grafana/grafana.log`
- The default configuration specifies sqlite3 db at `/var/lib/grafana/grafana.db`

## Start the server (init.d service)

- Start grafana by `sudo service grafana-server start`
- This will start the grafana-server process as the `grafana` user (created during package install)
- Default http port is `3000`, and default user is admin/admin

To configure Grafana server to start at boot time:

    $ sudo update-rc.d grafana-server defaults 95 10

## Start the server (via systemd)
    $ systemctl daemon-reload
    $ systemctl start grafana-server
    $ systemctl status grafana-server

Enable the systemd service (so grafana starts at boot)

    sudo systemctl enable grafana-server.service

## Environment file

The systemd service file and init.d script both use the file located at `/etc/default/grafana-server` for
environment variables used when starting the backend. Here you can override log directory, data directory and other
variables.

### Logging

By default grafana will log to `/var/log/grafana`

### Database

The default configuration specifies a sqlite3 database located at `/var/lib/grafana/grafana.db`. Please backup
this database before upgrades. You can also use mysql or postgres as the Grafana database.

## Configuration

The configuration file is located at `/etc/grafana/grafana.ini`.  Go the [Configuration](configuration) page for details
on all those options.

### Adding data sources

- [Graphite](../datasources/graphite.md)
- [InfluxDB](../datasources/influxdb.md)
- [OpenTSDB](../datasources/opentsdb.md)

## Installing from binary tar file

Start by [downloading](http://grafana.org/download/builds) the latest `.tar.gz` file and extract it.
This will extract into a folder named after the version you downloaded. This folder contains all files required to run grafana.
There are no init scripts or install scripts in this package.

To configure grafana add a config file named `custom.ini` to the `conf` folder and override any of the settings defined in
`conf/defaults.ini`. Start grafana by excecuting `./grafana web`. The grafana binary needs the working directory
to be the root install dir (where the binary is and the public folder is located).


