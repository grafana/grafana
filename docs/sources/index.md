+++
title = "Docs Home"
description = "Install guide for Grafana"
keywords = ["grafana", "installation", "documentation"]
type = "docs"
aliases = ["v1.1", "guides/reference/admin"]
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
- [Nightly Builds](https://grafana.com/grafana/download)

For other platforms Read the [build from source]({{< relref "project/building_from_source.md" >}})
instructions for more information.

## Configuring Grafana

The back-end web server has a number of configuration options. Go the
[Configuration]({{< relref "installation/configuration.md" >}}) page for details on all
those options.


## Getting started

- [Getting Started]({{< relref "guides/getting_started.md" >}})
- [Basic Concepts]({{< relref "guides/basic_concepts.md" >}})
- [Screencasts]({{< relref "tutorials/screencasts.md" >}})

## Data sources guides

- [Graphite]({{< relref "features/datasources/graphite.md" >}})
- [Elasticsearch]({{< relref "features/datasources/elasticsearch.md" >}})
- [InfluxDB]({{< relref "features/datasources/influxdb.md" >}})
- [OpenTSDB]({{< relref "features/datasources/opentsdb.md" >}})


