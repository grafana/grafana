---
page_title: Installing on RPM-based Linux
page_description: Grafana Installation guide for Centos, Fedora, Redhat.
page_keywords: grafana, installation, centos, fedora, opensuse, redhat, guide
---

# Installing on RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)

## Download

Description | Download
------------ | -------------
.RPM for Fedora / RHEL / CentOS Linux | [grafana-2.0.0_beta3-1.x86_64.rpm](https://grafanarel.s3.amazonaws.com/builds/grafana-2.0.0_beta3-1.x86_64.rpm)

## Install
To install the package

    $ wget https://grafanarel.s3.amazonaws.com/builds/grafana-2.0.0_beta3-1.x86_64.rpm
    $ sudo yum install initscripts fontconfig
    $ sudo rpm -Uvh grafana-2.0.0_beta3-1.x86_64.rpm

## Package details

- Installs binary to `/usr/sbin/grafana-server`
- Init.d script to `/etc/init.d/grafana-server`
- Default file (environment vars) to `/etc/sysconfig/grafana-server`
- Configuration file to `/etc/grafana/grafana.ini`
- Systemd service (if systemd is available) name `grafana-server.service`
- The default configuration specifies log file at `/var/log/grafana/grafana.log`
- The default configuration specifies sqlite3 db at `/var/lib/grafana/grafana.db`

## Start the server (init.d service)

- Start grafana by `sudo service grafana-server start`
- This will start the grafana-server process as the `grafana` user (created during package install)
- Default http port is `3000`, and default user is admin/admin
- To configure grafana server to start at boot time: `sudo /sbin/chkconfig --add grafana-server`

## Start the server (via systemd)

    $ systemctl daemon-reload
    $ systemctl start grafana-server
    $ systemctl status grafana-server

### Enable the systemd service (so grafana starts at boot)

    sudo systemctl enable grafana-server.service

## Environment file

The systemd service file and init.d script both use the file located at `/etc/sysconfig/grafana-server` for
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


