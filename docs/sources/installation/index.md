---
page_title: Grafana Installation
page_description: Install guide for Grafana.
page_keywords: grafana, installation, documentation
---

# Installation

Grafana is easily installed via a Debian/Ubuntu package (.deb), via
Redhat/Centos package (.rpm) or manually via a tarball that contains all
required files and binaries. If you can't find a package or binary for
your platform you might be able to build one your self, read the [build
from source](../project/building_from_source) instructions for more
information.

- [Installing on Debian / Ubuntu](debian.md)
- [Installing on RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)](rpm.md)
- [Installing on Mac OS X](mac.md)
- [Installing on Windows](windows.md)
- [Installing on Docker](docker.md)
- [Installing using Provisioning (Chef, Puppet, Salt, Ansible, etc)](provisioning.md)
- [Nightly Builds](http://grafana.org/download/builds.html)

## Configuration

The back-end web server has a number of configuration options. Go the
[Configuration](/installation/configuration) page for details on all
those options.

## Adding data sources

- [Graphite](../datasources/graphite.md)
- [InfluxDB](../datasources/influxdb.md)
- [OpenTSDB](../datasources/opentsdb.md)


