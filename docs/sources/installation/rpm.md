+++
title = "Installing on RPM-based Linux"
description = "Grafana Installation guide for Centos, Fedora, OpenSuse, Redhat."
keywords = ["grafana", "installation", "documentation", "centos", "fedora", "opensuse", "redhat"]
aliases = ["installation/installation/rpm"]
type = "docs"
[menu.docs]
name = "Installing on Centos / Redhat"
identifier = "rpm"
parent = "installation"
weight = 2
+++

# Installing on RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)

Description | Download
------------ | -------------
Stable for CentOS / Fedora / OpenSuse / Redhat Linux | [x86-64](https://grafana.com/grafana/download?platform=linux)
Stable for CentOS / Fedora / OpenSuse / Redhat Linux | [ARM64](https://grafana.com/grafana/download?platform=arm)
Stable for CentOS / Fedora / OpenSuse / Redhat Linux | [ARMv7](https://grafana.com/grafana/download?platform=arm)

Read [Upgrading Grafana]({{< relref "installation/upgrading.md" >}}) for tips and guidance on updating an existing installation.

## Install Stable

You can install Grafana using Yum directly.

```bash
$ sudo yum install <rpm package url>
```

Example:

```bash
$ sudo yum install https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-5.1.4-1.x86_64.rpm
```

Or install manually using `rpm`. First execute

```bash
$ wget <rpm package url>
```

Example:

```bash
$ wget https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-5.1.4-1.x86_64.rpm
```

### On CentOS / Fedora / Redhat:

```bash
$ sudo yum install initscripts fontconfig
$ sudo rpm -Uvh <local rpm package>
```

### On OpenSuse:

```bash
$ sudo rpm -i --nodeps <local rpm package>
```

## Install via YUM Repository

Add the following to a new file at `/etc/yum.repos.d/grafana.repo`

```bash
[grafana]
name=grafana
baseurl=https://packagecloud.io/grafana/stable/el/7/$basearch
repo_gpgcheck=1
enabled=1
gpgcheck=1
gpgkey=https://packagecloud.io/gpg.key https://grafanarel.s3.amazonaws.com/RPM-GPG-KEY-grafana
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
```

There is also a testing repository if you want beta or release candidates.

```bash
baseurl=https://packagecloud.io/grafana/testing/el/7/$basearch
```

Then install Grafana via the `yum` command.

```bash
$ sudo yum install grafana
```

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

```bash
$ sudo service grafana-server start
```

This will start the `grafana-server` process as the `grafana` user,
which is created during package installation. The default HTTP port is
`3000`, and default user and group is `admin`.

Default login and password `admin`/ `admin`

To configure the Grafana server to start at boot time:

```bash
$ sudo /sbin/chkconfig --add grafana-server
```

## Start the server (via systemd)

```bash
$ systemctl daemon-reload
$ systemctl start grafana-server
$ systemctl status grafana-server
```

### Enable the systemd service to start at boot

```bash
sudo systemctl enable grafana-server.service
```

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

### Server side image rendering

Server side image (png) rendering is a feature that is optional but very useful when sharing visualizations,
for example in alert notifications.

If the image is missing text make sure you have font packages installed.

```bash
yum install fontconfig
yum install freetype*
yum install urw-fonts
```

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

## Logging in for the first time

To run Grafana open your browser and go to http://localhost:3000/. 3000 is the default http port that Grafana listens to if you haven't [configured a different port](/installation/configuration/#http-port).
Then follow the instructions [here](/guides/getting_started/).