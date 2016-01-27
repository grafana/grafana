---
page_title: Installing on RPM-based Linux
page_description: Grafana Installation guide for Centos, Fedora, OpenSuse, Redhat.
page_keywords: grafana, installation, centos, fedora, opensuse, redhat, guide
---

# Installing on RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)

## Download

Description | Download
------------ | -------------
.RPM for CentOS / Fedora / OpenSuse / Redhat Linux | [grafana-2.6.0-1.x86_64.rpm](https://grafanarel.s3.amazonaws.com/builds/grafana-2.6.0-1.x86_64.rpm)

## Install from package file

You can install Grafana using Yum directly.

    $ sudo yum install https://grafanarel.s3.amazonaws.com/builds/grafana-2.6.0-1.x86_64.rpm

Or install manually using `rpm`.

#### On CentOS / Fedora / Redhat:

    $ sudo yum install initscripts fontconfig
    $ sudo rpm -Uvh grafana-2.6.0-1.x86_64.rpm

#### On OpenSuse:

    $ sudo rpm -i --nodeps grafana-2.6.0-1.x86_64.rpm

## Install via YUM Repository

Add the following to a new file at `/etc/yum.repos.d/grafana.repo`

    [grafana]
    name=grafana
    baseurl=https://packagecloud.io/grafana/stable/el/6/$basearch
    repo_gpgcheck=1
    enabled=1
    gpgcheck=1
    gpgkey=https://packagecloud.io/gpg.key https://grafanarel.s3.amazonaws.com/RPM-GPG-KEY-grafana
    sslverify=1
    sslcacert=/etc/pki/tls/certs/ca-bundle.crt

There is also a testing repository if you want beta or release
candidates.

    baseurl=https://packagecloud.io/grafana/testing/el/6/$basearch

Then install Grafana via the `yum` command.

    $ sudo yum install grafana

### RPM GPG Key

The RPMs are signed, you can verify the signature with this [public GPG
key](https://grafanarel.s3.amazonaws.com/RPM-GPG-KEY-grafana).

## Package details

- Installs binary to `/usr/sbin/grafana-server`
- Copies init.d script to `/etc/init.d/grafana-server`
- Installs default file (environment vars) to `/etc/sysconfig/grafana-server`
- Copies configuration file to `/etc/grafana/grafana.ini`
- Installs systemd service (if systemd is available) name `grafana-server.service`
- The default configuration uses a log file at `/var/log/grafana/grafana.log`
- The default configuration specifies an sqlite3 database at `/var/lib/grafana/grafana.db`

## Start the server (init.d service)

You can start Grafana by running:

    $ sudo service grafana-server start

This will start the `grafana-server` process as the `grafana` user,
which is created during package installation. The default HTTP port is
`3000`, and default user and group is `admin`.

To configure the Grafana server to start at boot time:

    $ sudo /sbin/chkconfig --add grafana-server

## Start the server (via systemd)

    $ systemctl daemon-reload
    $ systemctl start grafana-server
    $ systemctl status grafana-server

### Enable the systemd service to start at boot

    sudo systemctl enable grafana-server.service

## Environment file

The systemd service file and init.d script both use the file located at
`/etc/sysconfig/grafana-server` for environment variables used when
starting the back-end. Here you can override log directory, data
directory and other variables.

### Logging

By default Grafana will log to `/var/log/grafana`

### Database

The default configuration specifies a sqlite3 database located at
`/var/lib/grafana/grafana.db`. Please backup this database before
upgrades. You can also use MySQL or Postgres as the Grafana database, as detailed on [the configuration page](configuration.md#database).

## Configuration

The configuration file is located at `/etc/grafana/grafana.ini`.  Go the
[Configuration](/installation/configuration) page for details on all
those options.

### Adding data sources

- [Graphite](../datasources/graphite.md)
- [InfluxDB](../datasources/influxdb.md)
- [OpenTSDB](../datasources/opentsdb.md)


