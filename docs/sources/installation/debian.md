---
page_title: Installing on Debian / Ubuntu
page_description: Grafana Installation guide for Debian / Ubuntu.
page_keywords: grafana, installation, debian, ubuntu, guide
---

# Installing on Debian / Ubuntu

## Download

Description | Download
------------ | -------------
.deb for Debian-based Linux | [grafana_2.0.0-beta3_amd64.deb](https://grafanarel.s3.amazonaws.com/builds/grafana_2.0.0-beta3_amd64.deb)

## Install
To install the package

    $ wget https://grafanarel.s3.amazonaws.com/builds/grafana_2.0.0-beta3_amd64.deb
    $ sudo apt-get install -y adduser libfontconfig
    $ sudo dpkg -i grafana_latest_amd64.deb

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

## Start the server (via systemd)

    $ systemctl daemon-reload
    $ systemctl start grafana-server
    $ systemctl status grafana-server

## Environment file

The systemd service file and init.d script both use the file located at `/etc/default/grafana-server` for
environment variables used when starting the backend. Here you can override log directory, data directory and other
variables.

### Logging

By default grafana will log to /var/log/grafana

## Configuration

The configuration file is located at `/etc/grafana/grafana.ini`.  Go the [Configuration](configuration) page for details
on all those options.

### Adding data sources

- [Graphite](../datasources/graphite.md)
- [InfluxDB](../datasources/influxdb.md)
- [OpenTSDB](../datasources/opentsdb.md)

