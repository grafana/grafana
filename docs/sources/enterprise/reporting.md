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
* The Image Renderer plugin must be installed or the remote rendering service must be set up. Refer to [Image rendering]({{< relref "../administration/image_rendering.md" >}}) for more information.

## Create or update a report

Currently only Organization Admins can create reports.

{{< docs-imagebox img="/img/docs/enterprise/reports_create_new.png" max-width="500px" class="docs-image--no-shadow" >}}

1. Click on the reports icon in the side menu. The Reports tab allow you to view, create, and update your reports.
1. Enter report information.
   * Name
   * Choose dashboard
   * Recipients
   * Reply to
   * Custom message 
1. Preview the report to make sure it appears as you expect. Update if necessary.
1. Enter scheduling information. Options vary depending on the frequency you select.
1. Save the report.





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
