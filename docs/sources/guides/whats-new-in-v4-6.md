+++
title = "What's new in Grafana v4.6"
description = "Feature and improvement highlights for Grafana v4.6"
keywords = ["grafana", "new", "documentation", "4.6", "release notes"]
type = "docs"
[menu.docs]
name = "Version 4.6"
identifier = "v4.6"
parent = "whatsnew"
weight = -5
+++

# What's new in Grafana v4.6

Grafana v4.6 brings many enhancements to Annotations, Cloudwatch and Prometheus. It also adds support for Postgres as metric and table data source!

### Annotations

{{< docs-imagebox img="/img/docs/v46/add_annotation_region.png"  max-width= "800px" >}}

You can now add annotation events and regions right from the graph panel! Just hold Ctrl/Cmd+Click or drag region to open the **Add Annotation** view. The
[Annotations]({{< relref "../dashboards/annotations.md" >}}) documentation is updated to include details on this new exciting feature.

### Cloudwatch

Cloudwatch now supports alerting. Setup alert rules for any Cloudwatch metric!

{{< docs-imagebox img="/img/docs/v46/cloudwatch_alerting.png"  max-width= "800px" >}}

### Postgres

Grafana v4.6 now ships with a built-in data source plugin for Postgres. Have logs or metric data in Postgres? You can now visualize that data and
define alert rules on it like any of our other data sources.

{{< docs-imagebox img="/img/docs/v46/postgres_table_query.png"  max-width= "800px" >}}

### Prometheus

New enhancements include support for **instant queries** and improvements to query editor in the form of autocomplete for label names and label values.
This makes exploring and filtering Prometheus data much easier.

## Changelog

### New Features

* **GCS**: Adds support for Google Cloud Storage [#8370](https://github.com/grafana/grafana/issues/8370) thx [@chuhlomin](https://github.com/chuhlomin)
* **Prometheus**: Adds /metrics endpoint for exposing Grafana metrics. [#9187](https://github.com/grafana/grafana/pull/9187)
* **Graph**: Add support for local formatting in axis. [#1395](https://github.com/grafana/grafana/issues/1395), thx [@m0nhawk](https://github.com/m0nhawk)
* **Jaeger**: Add support for open tracing using jaeger in Grafana. [#9213](https://github.com/grafana/grafana/pull/9213)
* **Unit types**: New date and time unit types added, useful in singlestat to show dates and times. [#3678](https://github.com/grafana/grafana/issues/3678), [#6710](https://github.com/grafana/grafana/issues/6710), [#2764](https://github.com/grafana/grafana/issues/2764)
* **CLI**: Make it possible to install plugins from any URL [#5873](https://github.com/grafana/grafana/issues/5873)
* **Prometheus**: Add support for instant queries [#5765](https://github.com/grafana/grafana/issues/5765), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Add support for alerting using the cloudwatch data source [#8050](https://github.com/grafana/grafana/pull/8050), thx [@mtanda](https://github.com/mtanda)
* **Pagerduty**: Include triggering series in pagerduty notification [#8479](https://github.com/grafana/grafana/issues/8479), thx [@rickymoorhouse](https://github.com/rickymoorhouse)
* **Timezone**: Time ranges like Today and Yesterday now work correctly when timezone setting is set to UTC [#8916](https://github.com/grafana/grafana/issues/8916), thx [@ctide](https://github.com/ctide)
* **Prometheus**: Align $__interval with the step parameters. [#9226](https://github.com/grafana/grafana/pull/9226), thx [@alin-amana](https://github.com/alin-amana)
* **Prometheus**: Autocomplete for label name and label value [#9208](https://github.com/grafana/grafana/pull/9208), thx [@mtanda](https://github.com/mtanda)
* **Postgres**: New Postgres data source [#9209](https://github.com/grafana/grafana/pull/9209), thx [@svenklemm](https://github.com/svenklemm)
* **Data sources**: closes [#9371](https://github.com/grafana/grafana/issues/9371), [#5334](https://github.com/grafana/grafana/issues/5334), [#8812](https://github.com/grafana/grafana/issues/8812), thx [@mattbostock](https://github.com/mattbostock)

### Minor Changes

* **SMTP**: Make it possible to set specific EHLO for SMTP client. [#9319](https://github.com/grafana/grafana/issues/9319)
* **Dataproxy**: Allow Grafana to renegotiate TLS connection [#9250](https://github.com/grafana/grafana/issues/9250)
* **HTTP**: set net.Dialer.DualStack to true for all HTTP clients [#9367](https://github.com/grafana/grafana/pull/9367)
* **Alerting**: Add diff and percent diff as series reducers [#9386](https://github.com/grafana/grafana/pull/9386), thx [@shanhuhai5739](https://github.com/shanhuhai5739)
* **Slack**: Allow images to be uploaded to slack when Token is present [#7175](https://github.com/grafana/grafana/issues/7175), thx [@xginn8](https://github.com/xginn8)
* **Opsgenie**: Use their latest API instead of old version [#9399](https://github.com/grafana/grafana/pull/9399), thx [@cglrkn](https://github.com/cglrkn)
* **Table**: Add support for displaying the timestamp with milliseconds [#9429](https://github.com/grafana/grafana/pull/9429), thx [@s1061123](https://github.com/s1061123)
* **Hipchat**: Add metrics, message and image to hipchat notifications [#9110](https://github.com/grafana/grafana/issues/9110), thx [@eloo](https://github.com/eloo)
* **Postgres**: modify group by time macro so it can be used in select clause [#9527](https://github.com/grafana/grafana/pull/9527), thanks [@svenklemm](https://github.com/svenklemm)

### Tech
* **Go**: Grafana is now built using golang 1.9
