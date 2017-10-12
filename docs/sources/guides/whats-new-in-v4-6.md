+++
title = "What's New in Grafana v4.6"
description = "Feature & improvement highlights for Grafana v4.6"
keywords = ["grafana", "new", "documentation", "4.6"]
type = "docs"
[menu.docs]
name = "Version 4.6"
identifier = "v4.6"
parent = "whatsnew"
weight = -5
+++

# What's New in Grafana v4.6

## Hightlights

### Annotations

Annotations provide a way to mark points on the graph with rich events. When you hover over an annotation you can get event description and event tags. The text field can include links to other systems with more detail.

### Cloudwatch

{{< docs-imagebox img="/img/docs/v46/cloudwatch_alerting.png"  max-width= "600px" >}}

### Postgres

{{< docs-imagebox img="/img/docs/v46/postgres_table_query.png"  max-width= "600px" >}}
{{< docs-imagebox img="/img/docs/v46/postgres_table.png"  max-width= "600px" >}}

### Prometheus

With the new features instant queries and autocomplete label name and value makes quering with Prometheus a lot easier.

## Changelog

### New Features

* **GCS**: Adds support for Google Cloud Storage [#8370](https://github.com/grafana/grafana/issues/8370) thx [@chuhlomin](https://github.com/chuhlomin)
* **Prometheus**: Adds /metrics endpoint for exposing Grafana metrics. [#9187](https://github.com/grafana/grafana/pull/9187)
* **Graph**: Add support for local formating in axis. [#1395](https://github.com/grafana/grafana/issues/1395), thx [@m0nhawk](https://github.com/m0nhawk)
* **Jaeger**: Add support for open tracing using jaeger in Grafana. [#9213](https://github.com/grafana/grafana/pull/9213)
* **Unit types**: New date & time unit types added, useful in singlestat to show dates & times. [#3678](https://github.com/grafana/grafana/issues/3678), [#6710](https://github.com/grafana/grafana/issues/6710), [#2764](https://github.com/grafana/grafana/issues/2764)
* **CLI**: Make it possible to install plugins from any url [#5873](https://github.com/grafana/grafana/issues/5873)
* **Prometheus**: Add support for instant queries [#5765](https://github.com/grafana/grafana/issues/5765), thx [@mtanda](https://github.com/mtanda)
* **Cloudwatch**: Add support for alerting using the cloudwatch datasource [#8050](https://github.com/grafana/grafana/pull/8050), thx [@mtanda](https://github.com/mtanda)
* **Pagerduty**: Include triggering series in pagerduty notification [#8479](https://github.com/grafana/grafana/issues/8479), thx [@rickymoorhouse](https://github.com/rickymoorhouse)
* **Timezone**: Time ranges like Today & Yesterday now work correctly when timezone setting is set to UTC [#8916](https://github.com/grafana/grafana/issues/8916), thx [@ctide](https://github.com/ctide)
* **Prometheus**: Align $__interval with the step parameters. [#9226](https://github.com/grafana/grafana/pull/9226), thx [@alin-amana](https://github.com/alin-amana)
* **Prometheus**: Autocomplete for label name and label value [#9208](https://github.com/grafana/grafana/pull/9208), thx [@mtanda](https://github.com/mtanda)
* **Postgres**: New Postgres data source [#9209](https://github.com/grafana/grafana/pull/9209), thx [@svenklemm](https://github.com/svenklemm)
* **Datasources**: closes [#9371](https://github.com/grafana/grafana/issues/9371), [#5334](https://github.com/grafana/grafana/issues/5334), [#8812](https://github.com/grafana/grafana/issues/8812), thx [@mattbostock](https://github.com/mattbostock)

### Minor Changes

* **SMTP**: Make it possible to set specific EHLO for smtp client. [#9319](https://github.com/grafana/grafana/issues/9319)
* **Dataproxy**: Allow grafan to renegotiate tls connection [#9250](https://github.com/grafana/grafana/issues/9250)
* **HTTP**: set net.Dialer.DualStack to true for all http clients [#9367](https://github.com/grafana/grafana/pull/9367)
* **Alerting**: Add diff and percent diff as series reducers [#9386](https://github.com/grafana/grafana/pull/9386), thx [@shanhuhai5739](https://github.com/shanhuhai5739)
* **Slack**: Allow images to be uploaded to slack when Token is precent [#7175](https://github.com/grafana/grafana/issues/7175), thx [@xginn8](https://github.com/xginn8)
* **Opsgenie**: Use their latest API instead of old version [#9399](https://github.com/grafana/grafana/pull/9399), thx [@cglrkn](https://github.com/cglrkn)
* **Table**: Add support for displaying the timestamp with milliseconds [#9429](https://github.com/grafana/grafana/pull/9429), thx [@s1061123](https://github.com/s1061123)
* **Hipchat**: Add metrics, message and image to hipchat notifications [#9110](https://github.com/grafana/grafana/issues/9110), thx [@eloo](https://github.com/eloo)

### Tech
* **Go**: Grafana is now built using golang 1.9

