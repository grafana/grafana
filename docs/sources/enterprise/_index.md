+++
title = "Grafana Enterprise"
description = "Grafana Enterprise overview"
keywords = ["grafana", "documentation", "datasource", "permissions", "ldap", "licensing", "enterprise", "insights", "reporting"]
type = "docs"
[menu.docs]
name = "Grafana Enterprise"
identifier = "enterprise"
weight = 100
+++

# Grafana Enterprise

Grafana Enterprise is a commercial edition of Grafana that includes additional features not found in the open source version.

Building on everything you already know and love about Grafana, Grafana Enterprise adds enterprise data sources, advanced authentication options, more permission controls, 24x7x365 support, and training from the core Grafana team.

Grafana Enterprise includes all of the features found in the open source edition and more.

[Learn more about Grafana Enterprise.](https://grafana.com/enterprise)

## Enhanced security features

Grafana Enterprise includes integrations with more ways to authenticate your users and enhanced authorization capabilities.

### Data source permissions

[Data source permissions]({{< relref "datasource_permissions.md" >}}) allow you to restrict query access to only specific teams and users.

### Enhanced LDAP integration

With Grafana Enterprise [enhanced LDAP]({{< relref "enhanced_ldap.md" >}}), you can set up synchronization between LDAP groups and Grafana teams.

### SAML authentication

[SAML authentication]({{< relref "saml.md" >}}) enables your Grafana Enterprise users to authenticate with SAML.

### Team sync

[Team sync]({{< relref "team-sync.md" >}}) allows you to set up synchronization between teams in Grafana and teams in your auth provider so that your users automatically end up in the right team.

Supported auth providers:

* [Auth Proxy]({{< relref "../auth/auth-proxy.md#team-sync-enterprise-only">}})
* [GitHub OAuth]({{< relref "../auth/github.md#team-sync-enterprise-only" >}})
* [GitLab OAuth]({{< relref "../auth/gitlab.md#team-sync-enterprise-only" >}})
* [LDAP]({{< relref "enhanced_ldap.md#ldap-group-synchronization-for-teams" >}})

## Reporting

[Reporting]({{< relref "reporting.md" >}}) allows you to take any dashboard, generate a PDF report, and set up a schedule to have it emailed to whoever you choose.

## Export dashboard as PDF

[Export dashboard as PDF]({{< relref "export-pdf.md" >}}) allows you to export a dashboard as a PDF document.

## White labeling

[White labeling]({{< relref "white-labeling.md" >}}) allows you to replace the Grafana brand and logo with your own corporate brand and logo. You can also change footer links to point to your custom resources.

## Usage insights

[Usage insights]({{< relref "usage-insights.md" >}}) allow you to understand how your Grafana instance is used. You can see who is looking at a dashboard, how often a dashboard is seen, and which dashboards are prone to errors. You'll also be able to discover what are the least and the most used dashboards.

## Enterprise plugins

With a Grafana Enterprise license, you get access to premium plugins, including:

* [Amazon Timestream](https://grafana.com/plugins/grafana-timestream-datasource)
* [AppDynamics](https://grafana.com/plugins/dlopes7-appdynamics-datasource)
* [DataDog](https://grafana.com/plugins/grafana-datadog-datasource)
* [Dynatrace](https://grafana.com/plugins/grafana-dynatrace-datasource)
* [New Relic](https://grafana.com/plugins/grafana-newrelic-datasource)
* [Oracle Database](https://grafana.com/plugins/grafana-oracle-datasource)
* [ServiceNow](https://grafana.com/grafana/plugins/grafana-servicenow-datasource)
* [Splunk](https://grafana.com/plugins/grafana-splunk-datasource)

## Try Grafana Enterprise

To purchase or obtain a trial license contact the Grafana Labs [Sales Team](https://grafana.com/contact?about=support&topic=Grafana%20Enterprise).

## License file management

To download your Grafana Enterprise license log in to your [Grafana.com](https://grafana.com) account and go to your **Org Profile**. In the side menu there is a section for Grafana Enterprise licenses. At the bottom of the license details page there is **Download Token** link that will download the *license.jwt* file containing your license.

Place the *license.jwt* file in Grafana's data folder. This is usually located at `/var/lib/grafana/data` on Linux systems.

You can also configure a custom location for the license file via the ini setting:

```bash
[enterprise]
license_path = /company/secrets/license.jwt
```

This setting can also be set with an environment variable, which is useful if you're running Grafana with Docker and have a custom volume where you have placed the license file. In this case, set the environment variable `GF_ENTERPRISE_LICENSE_PATH` to point to the location of your license file.
