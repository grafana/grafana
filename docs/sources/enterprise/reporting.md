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
1. Enter report information. All fields are required unless otherwise indicated.
   * **Name -** Name of the report as you want it to appear in the Reports list.
   * **Choose dashboard -** Select the dashboard to generate the report from.
   * **Recipients -** Enter the emails of the people or teams that you want to receive the report.
   * **Reply to -** (optional) The address that will appear in the **Reply to** field of the email. 
   * **Custom message -** Message body in the email with the report.
2. **Preview** the report to make sure it appears as you expect. Update if necessary.
3. Enter scheduling information. Options vary depending on the frequency you select.
4. **Save** the report.

## Troubleshoot reporting

To troubleshoot and get more log information, enable debug logging in the configuration file. Refer to [Configuration]({{< relref "../installation/configuration.md#filters" >}}) for more information.

```bash
[log]
filters = saml.auth:debug
```
