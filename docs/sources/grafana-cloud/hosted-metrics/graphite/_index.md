---
title: Grafana Cloud Graphite
header: false
---

# Hosted Metrics - Graphite

Grafana Labs' Hosted metrics Graphite service offers a graphite-compatible monitoring backend as a service.
It acts and behaves as a regular graphite datasource within Grafana (or other tools), but behind the scenes, it is a sophisticated platform run by a team of dedicated engineers.

* [data ingestion]({{< relref "data-ingestion" >}})
* [http api]({{< relref "http-api" >}})
* [faq]({{< relref "faq" >}})

## Finding your API endpoints

Several examples below have a `<instance URL>` placeholder.
To identify your instance URL, login at grafana.com and
navigate to your Hosted Metrics instance details.


## Using Grafana with Hosted Metrics

Configuring Grafana for Hosted Metrics works the same way,
whether you’re using your own Grafana or Hosted Grafana.

Once logged into your Grafana, you need to add a data source for Hosted Metrics
with the following details:

**Grafana Data Source settings**

Field          | Value
---------------|-------
**Name**       | `grafanacloud-<org>-graphite`
**Type**       | Graphite
**URL**        | `https://<instance URL>.hosted-metrics.grafana.net/graphite`
**Access**     | Proxy
**Basic Auth** | Checked
**User**       | `api_key`
**Password**   | Your Grafana.com API key


## Sending Data with Carbon-Relay-NG

There are a variety of ways that you can send your data to Hosted Metrics.

In most situations, you should install a carbon-relay-ng service
in each of the datacenter or regions that you will be sending metrics from.

This will accept plain-text carbon (Graphite) input,
and stream your encrypted metrics to the Hosted Metrics.
Since carbon-relay-ng can buffer metric streams in memory,
this also provides increased resiliency to connectivity issues.

`carbon-relay-ng` is available for most Linux platforms, and is easy to install.

* [EL6 (Red Hat 6.x, CentOS 6.x, and CloudLinux 6.x)](https://packagecloud.io/raintank/raintank/packages/el/6/carbon-relay-ng-0.12.0-1.x86_64.rpm)
* [EL7 (Red Hat 7.x, CentOS 7.x, and CloudLinux 7.x.)](https://packagecloud.io/raintank/raintank/packages/el/7/carbon-relay-ng-0.12.0-1.x86_64.rpm)
* [Debian Jessie](https://packagecloud.io/raintank/raintank/packages/debian/jessie/carbon-relay-ng_0.12.0-1_amd64.deb)
* [Debian Stretch](https://packagecloud.io/raintank/raintank/packages/debian/stretch/carbon-relay-ng_0.12.0-1_amd64.deb)
* [Debian Buster](https://packagecloud.io/raintank/raintank/packages/debian/buster/carbon-relay-ng_0.12.0-1_amd64.deb)
* [Ubuntu Xenial](https://packagecloud.io/raintank/raintank/packages/ubuntu/xenial/carbon-relay-ng_0.12.0-1_amd64.deb)
* [Ubuntu Trusty](https://packagecloud.io/raintank/raintank/packages/ubuntu/trusty/carbon-relay-ng_0.12.0-1_amd64.deb)

We recommend installing the latest version.
Once installed, you can configure the relay in two steps:


### 1. Edit carbon-relay-ng.conf

Edit the carbon-relay-ng.conf configuration file (normally located at /etc/carbon-relay-ng/carbon-relay-ng.conf), and replace it with the settings below:

> * The "apikey" setting must be a Grafana.com API Key with the editor or admin role.
> * Make sure the "schemasFile" field is set to the path to your storage-schemas.conf file (see below)

```yaml
## Global settings ##
# instance id's distinguish stats of multiple relays.
# do not run multiple relays with the same instance id.
# supported variables:
#  ${HOST} : hostname
instance = "${HOST}"

## System ##
# this setting can be used to override the default GOMAXPROCS logic
# it is ignored if the GOMAXPROCS environment variable is set
max_procs = 2
pid_file = "carbon-relay-ng.pid"
# directory for spool files
spool_dir = "spool"

## Logging ##
# one of trace debug info warn error fatal panic
# see docs/logging.md for level descriptions
# note: if you used to use "notice", you should now use "info".
log_level = "info"

## Inputs ##
### plaintext Carbon ###
listen_addr = "0.0.0.0:2003"
# close inbound plaintext connections if they've been idle for this long ("0s" to disable)
plain_read_timeout = "2m"
### Pickle Carbon ###
pickle_addr = "0.0.0.0:2013"
# close inbound pickle connections if they've been idle for this long ("0s" to disable)
pickle_read_timeout = "2m"

## Validation of inputs ##
# you can also validate that each series has increasing timestamps
validate_order = false

# How long to keep track of invalid metrics seen
# Useful time units are "s", "m", "h"
bad_metrics_max_age = "24h"

[[route]]
key = 'grafanaNet'
type = 'grafanaNet'
addr = 'https://<instance URL>.hosted-metrics.grafana.net/metrics'
apikey = '<Your Grafana.com API Key>'
schemasFile = '/etc/carbon-relay-ng/storage-schemas.conf'

## Instrumentation ##
[instrumentation]
# in addition to serving internal metrics via expvar, you can send them to graphite/carbon
# IMPORTANT: setting this to "" will disable flushing, and metrics will pile up and lead to OOM
# see https://github.com/graphite-ng/carbon-relay-ng/issues/50
# so for now you MUST send them somewhere. sorry.
# (Also, the interval here must correspond to your setting in storage-schemas.conf if you use grafana hosted metrics)
graphite_addr = "localhost:2003"
graphite_interval = 10000  # in ms
```


### 2. Create storage-schemas.conf

Create a new /etc/carbon-relay-ng/storage-schemas.conf file.
This file has the same format as the Graphite storage-schemas.conf file.

You can paste the below into the file to get started:

    [crng-service]
      pattern = ^service_is_carbon-relay-ng
      # interval should match graphite_interval in your relay configuration (default 10.000 ms)
      retentions = 10s:1d
    [crng-stats]
      pattern = ^carbon-relay-ng\.stats
      # interval should match graphite_interval in your relay configuration (default 10.000 ms)
      retentions = 10s:1d
    [default]
      pattern = .*
      retentions = 10s:1d

> This default assumes you are sending metrics at a 10s resolution, ie. 6 times per minute, which you may need to change.
> It is important that this file accurately describes your metrics and their raw resolutions (retentions mentioned in this file are ignored)
> You may need to extend it to match your metrics, or alternatively, copy it from your Graphite server and add in the rules
> for carbon-relay-ng metrics.
> If you update the carbon-relay-ng 'graphite_interval' parameter to something other than the default of 10.000ms (10s),
> you should set that update the rules for carbon-relay-ng here as well.

Once configured, you can send metrics to the relay in carbon/Graphite format in port 2003,
and they should show up in Grafana.
