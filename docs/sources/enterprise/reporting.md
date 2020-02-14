+++
title = "Reporting"
description = ""
keywords = ["grafana", "reporting"]
type = "docs"
aliases = ["/docs/grafana/latest/administration/reports"]
[menu.docs]
parent = "enterprise"
weight = 8
+++

# Reporting

> Only available in Grafana Enterprise v6.4+.

Reporting allows you to generate PDFs from any of your Dashboards and have them sent out to interested parties on a schedule.

{{< docs-imagebox img="/img/docs/enterprise/reports_list.png" max-width="500px" class="docs-image--no-shadow" >}}

## Dashboard as a Report

With Reports there are a few things to keep in mind, most importantly, any changes you make to the Dashboard used in a report will be reflected in the report. If you change the time range in the Dashboard the time range will be the same in the report as well.

## Setup

> SMTP must be configured for reports to be sent


### Rendering

> Reporting requires the [rendering plugin]({{< relref "../administration/image_rendering.md#grafana-image-renderer-plugin" >}}).

Reporting with the built-in image rendering is not supported. We recommend installing the image renderer plugin.

## Usage

{{< docs-imagebox img="/img/docs/enterprise/reports_create_new.png" max-width="500px" class="docs-image--no-shadow" >}}

Currently only Organisation Admins can create reports. To get to report click on the reports icon in the side menu. This will allow you to list, create and update your reports.

| Setting       | Description                                                       |
| --------------|------------------------------------------------------------------ |
| Name          | name of the Report                                                |
| Dashboard     | what dashboard to generate the report from                        |
| Recipients    | emails of the people who will receive this report                 |
| ReplyTo       | your email address, so that the recipient can respond             |
| Message       | message body in the email with the report                         |
| Schedule      | how often do you want the report generated and sent               |

## Debugging errors

If you have problems with the reporting feature you can enable debug logging by switching the logger to debug (`filters = report:debug`). Learn more about making configuration changes [here]({{< relref "../installation/configuration.md#filters" >}}).
