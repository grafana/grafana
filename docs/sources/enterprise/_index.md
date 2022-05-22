+++
aliases = ["/docs/grafana/latest/enterprise/"]
description = "Grafana Enterprise overview"
keywords = ["grafana", "documentation", "datasource", "permissions", "ldap", "licensing", "enterprise", "insights", "reporting"]
title = "Grafana Enterprise"
weight = 150
+++

# Grafana Enterprise

Grafana Enterprise is a commercial edition of Grafana that includes additional features not found in the open source version.

Building on everything you already know and love about Grafana open source, Grafana Enterprise includes [exclusive datasource plugins]({{< relref "#enterprise-plugins">}}) and [additional features]({{< relref "#enterprise-features">}}). On top of that you get 24x7x365 support and training from the core Grafana team.

To learn more about Grafana Enterprise, refer to [our product page.](https://grafana.com/enterprise)

## Authentication

Grafana Enterprise includes integrations with more ways to authenticate your users and enhanced authentication capabilities.

### Team sync

[Team sync]({{< relref "team-sync.md" >}}) allows you to set up synchronization between teams in Grafana and teams in your auth provider so that your users automatically end up in the right team.

Supported auth providers:

- [Auth Proxy]({{< relref "../auth/auth-proxy.md#team-sync-enterprise-only" >}})
- [Azure AD OAuth]({{< relref "../auth/azuread.md#team-sync-enterprise-only" >}})
- [GitHub OAuth]({{< relref "../auth/github.md#team-sync-enterprise-only" >}})
- [GitLab OAuth]({{< relref "../auth/gitlab.md#team-sync-enterprise-only" >}})
- [LDAP]({{< relref "enhanced_ldap.md#ldap-group-synchronization-for-teams" >}})
- [Okta]({{< relref "../auth/okta.md#team-sync-enterprise-only" >}})
- [SAML]({{< relref "./saml/configure-saml.md#configure-team-sync" >}})

### Enhanced LDAP integration

With Grafana Enterprise [enhanced LDAP]({{< relref "enhanced_ldap.md" >}}), you can set up active LDAP synchronization.

### SAML authentication

[SAML authentication]({{< relref "./saml" >}}) enables your Grafana Enterprise users to authenticate with SAML.

## Enterprise features

With Grafana Enterprise, you get access to the following features:

- [Role-based access control]({{< relref "./access-control/_index.md" >}}) to control access with role-based permissions.
- [Data source permissions]({{< relref "datasource_permissions.md" >}}) to restrict query access to specific teams and users.
- [Data source query caching]({{< relref "query-caching.md" >}}) to temporarily store query results in Grafana to reduce data source load and rate limiting.
- [Reporting]({{< relref "reporting.md" >}}) to generate a PDF report from any dashboard and set up a schedule to have it emailed to whoever you choose.
- [Export dashboard as PDF]({{< relref "export-pdf.md" >}})
- [White labeling]({{< relref "white-labeling.md" >}}) to customize Grafana from the brand and logo to the footer links.
- [Usage insights]({{< relref "usage-insights/_index.md" >}}) to understand how your Grafana instance is used.
- [Vault integration]({{< relref "vault.md" >}}) to manage your configuration or provisioning secrets with Vault.
- [Auditing]({{< relref "auditing.md" >}}) tracks important changes to your Grafana instance to help you manage and mitigate suspicious activity and meet compliance requirements.
- [Request security]({{< relref "request-security.md" >}}) makes it possible to restrict outgoing requests from the Grafana server.
- [Settings updates at runtime]({{< relref "settings-updates.md" >}}) allows you to update Grafana settings at runtime without requiring a restart.

## Enterprise data sources

With a Grafana Enterprise license, you get access to premium data sources, including:

- [AppDynamics](https://grafana.com/grafana/plugins/dlopes7-appdynamics-datasource)
- [Azure Devops](https://grafana.com/grafana/plugins/grafana-azuredevops-datasource)
- [DataDog](https://grafana.com/grafana/plugins/grafana-datadog-datasource)
- [Dynatrace](https://grafana.com/grafana/plugins/grafana-dynatrace-datasource)
- [Gitlab](https://grafana.com/grafana/plugins/grafana-gitlab-datasource)
- [Honeycomb](https://grafana.com/grafana/plugins/grafana-honeycomb-datasource)
- [Jira](https://grafana.com/grafana/plugins/grafana-jira-datasource)
- [MongoDB](https://grafana.com/grafana/plugins/grafana-mongodb-datasource)
- [New Relic](https://grafana.com/grafana/plugins/grafana-newrelic-datasource)
- [Oracle Database](https://grafana.com/grafana/plugins/grafana-oracle-datasource)
- [Salesforce](https://grafana.com/grafana/plugins/grafana-salesforce-datasource)
- [SAP HANA®](https://grafana.com/grafana/plugins/grafana-saphana-datasource)
- [ServiceNow](https://grafana.com/grafana/plugins/grafana-servicenow-datasource)
- [Snowflake](https://grafana.com/grafana/plugins/grafana-snowflake-datasource)
- [Splunk](https://grafana.com/grafana/plugins/grafana-splunk-datasource)
- [Splunk Infrastructure monitoring (SignalFx)](https://grafana.com/grafana/plugins/grafana-splunk-monitoring-datasource)
- [Wavefront](https://grafana.com/grafana/plugins/grafana-wavefront-datasource)

## Try Grafana Enterprise

To purchase or obtain a trial license contact the Grafana Labs [Sales Team](https://grafana.com/contact?about=support&topic=Grafana%20Enterprise).
