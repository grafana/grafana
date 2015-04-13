---
page_title: Grafana Installation
page_description: Install guide for Grafana.
page_keywords: grafana, installation, documentation
---

# Installation

Grafana is easily installed via a Debian/Ubuntu package (.deb), via Redhat/Centos package (.rpm) or manually via
a tar that contains all required files and binaries. If you can't find a package or binary for your platform you might be able
to build one your self, read [build from source](../project/building_from_source) instructions for more information.

- [Installing on Debian / Ubuntu](debian.md)
- [Installing on RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)](rpm.md)
- [Installing on Mac OS X](mac.md)
- [Installing on Windows](windows.md)
- [Installing on Docker](docker.md)


# Dependencies
There are no dependencies with the default configuration. You can switch from a sqlite3 database to mysql or postgres but
that is optional. For small to medium setups sqlite3 should suffice.

## Install using provisioning
If you prefer to install grafana via Puppet, Ansible, Docker or Chef. [This page](provisioning) has compiled a
list of repositories for different provisioning systems

## Configuration

The backend web server has a number of configuration options. Go the [Configuration](configuration) page for details
on all those options.



