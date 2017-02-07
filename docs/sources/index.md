+++
title = "Grafana Documentation Site"
description = "Install guide for Grafana"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
[menu.docs]
name = "Welcome to the Docs"
identifier = "root"
weight = -1
+++

# Welcome to the Grafana Documentation

Grafana is an open source metric analytics & visualization suite. It is most commonly used for
visualizing time series data for infrastructure and application analytics but many use it in
other domains including industrial sensors, home automation, weather, and process control.

## Installing Grafana
- [Installing on Debian / Ubuntu](installation/debian)
- [Installing on RPM-based Linux (CentOS, Fedora, OpenSuse, RedHat)](installation/rpm)
- [Installing on Mac OS X](installation/mac)
- [Installing on Windows](installation/windows)
- [Installing on Docker](installation/docker)
- [Installing using Provisioning (Chef, Puppet, Salt, Ansible, etc)](installation/provisioning)
- [Nightly Builds](http://grafana.org/builds)

For other platforms Read the [build from source]({{< relref "docs/project/building_from_source.md" >}})
instructions for more information.

## Configuring Grafana

The back-end web server has a number of configuration options. Go the
[Configuration]({{< relref "docs/installation/configuration.md" >}}) page for details on all
those options.


## Getting started

- [Getting Started]({{< relref "docs/guides/getting_started.md" >}})
- [Basic Concepts]({{< relref "docs/guides/basic_concepts.md" >}})
- [Screencasts]({{< relref "docs/tutorials/screencasts.md" >}})

## Data sources guides

- [Graphite]({{< relref "docs/features/datasources/graphite.md" >}})
- [Elasticsearch]({{< relref "docs/features/datasources/elasticsearch.md" >}})
- [InfluxDB]({{< relref "docs/features/datasources/influxdb.md" >}})
- [OpenTSDB]({{< relref "docs/features/datasources/opentsdb.md" >}})


