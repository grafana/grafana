---
page_title: Grafana Installation
page_description: Install guide for Grafana.
page_keywords: grafana, installation, documentation
---

# Installation
Grafana is easily installed via a Debian/Ubuntu package (.deb), via Redhat/Centos package (.rpm) or manually via
a tar that contains all required files and binaries. If you can't find a package or binary for your platform you might be able
to build one your self, read [build from source](../project/building_from_source) instructions for more information.

## Ubuntu & Debian
Start by [downloading](http://grafana.org/download/builds) the latest `.deb` package.

To install the package:

    $ sudo dpkg -i grafana_latest_amd64.deb

## Redhat & Centos
Start by [downloading](http://grafana.org/download/builds) the latest `.rpm` package.

    $ sudo rpm -Uvh grafana-latest-1.x86_64.rpm

On Redhat/RHEL 5.10 you need to add the grafana user before executing the above.
Execute this to add a grafana user:

    sudo useradd -r grafana

### Package details
The `.deb` and the `rpm` package install will do the following

- Install binaries and frontend files under `/opt/grafana/versions/<version>`
- Symlink dir `/opt/grafana/current` to `/opt/grafana/versions/<version>`
- Symlink `/etc/init.d/grafana` to `/opt/grafana/current/scripts/init.sh`
- Add config file to `/etc/grafana/grafana.ini` , this is where you specify your config settings
- Default configuration is in `/opt/grafana/current/conf/defaults.ini`, do not modify that file
- The default configuration specifies log file at `/var/log/grafana/grafana.log`
- The default configuration specifies sqlite3 db at `/opt/grafana/data/grafana.db`

### Start the backend & web server

- Start grafana by `sudo service grafana start`
- This will start the grafana process as the `grafana` user (created during package install)
- Default http port is `3000`, and default user is admin/admin

## Manual install from tar file
Start by [downloading](http://grafana.org/download/builds) the latest `.tar.gz` file and extract it.
This will extract into a folder named after the version you downloaded. This folder contains all files required to run grafana.
There are no init scripts or install scripts in this package.

To configure grafana add a config file named `custom.ini` to the `conf` folder and override any of the settings defined in
`conf/defaults.ini`. Start grafana by excecuting `./grafana web`. The grafana binary needs the working directory
to be the root install dir (where the binary is and the public folder is located).

## Dependencies
There are no dependencies with the default configuration. You can switch from a sqlite3 database to mysql or postgres but
that is optional. For small to medium setups sqlite3 should suffice.

## Install using provisioning
If you prefer to install grafana via Puppet, Ansible, Docker or Chef. [This page](provisioning) has compiled a
list of repositories for different provisioning systems

## Install from offical docker image

Grafana has an offical docker container.

    $ docker run -i -p 3000:3000 grafana/grafana:develop

All grafana configuration settings can be defined using ENVIRONMENT variables, this is especially useful when using the
above container.

### Docker volumes & ENV config

The docker container exposes two volumes, the sqlite3 database in the folder `/opt/grafana/data` and
configuration files in the `/opt/grafana/conf` folder. You can map these volumes to host folders when you start the container:

    $ docker run -d -p 3000:3000 \
        -v /var/grafana/data:/opt/grafana/data \
        -e "GF_SECURITY_ADMIN_PASSWORD=secret  \
        grafana/grafana:develop

In the above example I map the data folder and set a config option via an `ENV` variable.

## Configuration

The backend web server has a number of configuration options. Go the [Configuration](configuration) page for details
on all those options.





