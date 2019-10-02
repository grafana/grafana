+++
title = "Reports"
description = ""
keywords = ["grafana", "reports"]
type = "docs"
[menu.docs]
parent = "admin"
weight = 8
+++

# Reports

> Reports are only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "enterprise" >}}).

> Only available in Grafana v6.4+

With Reports you can generate PDFs of any of your Dashboards and have them sent out to interested parties on a schedule.

{{< docs-imagebox img="/img/docs/enterprise/reports_list.png" max-width="500px" class="docs-image--no-shadow" >}}

## Dashboard as a Report

With Reports there are a few things to keep in mind, most importantly, any changes you make to the Dashboard used in a report will be reflected in the report. If you change the time range in the Dashboard the time range will be the same in the report as well. 

## Setup

> SMTP must be configured for reports to be sent

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
