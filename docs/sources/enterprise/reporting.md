+++
title = "Reporting"
description = ""
keywords = ["grafana", "reporting"]
type = "docs"
aliases = ["/docs/grafana/latest/administration/reports"]
[menu.docs]
parent = "enterprise"
weight = 400
+++

# Reporting

Reporting allows you to automatically generate PDFs from any of your dashboards and have Grafana email them to interested parties on a schedule.

{{< docs-imagebox img="/img/docs/enterprise/reports_list.png" max-width="500px" class="docs-image--no-shadow" >}}

> Only available in Grafana Enterprise v6.4+.

Any changes you make to a dashboard used in a report are reflected the next time the report is sent. For example, if you change the time range in the dashboard, then the time range in the report changes as well.

## Requirements

* SMTP must be configured for reports to be sent. Refer to [SMTP]({{< relref "../installation/configuration.md#smtp" >}}) in [Configuration]({{< relref "../installation/configuration.md" >}}) for more information.
* The Image Renderer plugin must be installed or the remote rendering service must be set up.

> Reporting requires the [rendering plugin]({{< relref "../administration/image_rendering.md#grafana-image-renderer-plugin" >}}).


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

## Troubleshooting

To troubleshoot and get more log information, enable SAML debug logging in the configuration file. Refer to [Configuration]({{< relref "../installation/configuration.md#filters" >}}) for more information.

```bash
[log]
filters = saml.auth:debug
```
