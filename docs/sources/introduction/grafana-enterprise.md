---
aliases:
  - ../enterprise/
description: Grafana Enterprise overview
labels:
  products:
    - enterprise
title: Grafana Enterprise
weight: 200
---

# Grafana Enterprise

Grafana Enterprise is a commercial edition of Grafana that includes additional features not found in the open source version.

Building on everything you already know and love about Grafana open source, Grafana Enterprise includes [exclusive datasource plugins]({{< relref "#enterprise-data-sources" >}}) and [additional features]({{< relref "#enterprise-features" >}}). You also get 24x7x365 support and training from the core Grafana team.

To learn more about Grafana Enterprise, refer to [our product page](/enterprise).

## Enterprise features in Grafana Cloud

Many Grafana Enterprise features are also available in [Grafana Cloud](/docs/grafana-cloud) Free, Pro, and Advanced accounts. For details, refer to [Grafana Cloud pricing](/pricing/#featuresTable).

To migrate to Grafana Cloud, refer to [Migrate from Grafana Enterprise to Grafana Cloud](/docs/grafana-cloud/account-management/e2c-guide/).

## Authentication

Grafana Enterprise includes integrations with more ways to authenticate your users and enhanced authentication capabilities.

### Team sync

[Team sync]({{< relref "../setup-grafana/configure-security/configure-team-sync" >}}) allows you to set up synchronization between teams in Grafana and teams in your auth provider so that your users automatically end up in the right team.

Supported auth providers:

- [Auth Proxy]({{< relref "../setup-grafana/configure-security/configure-authentication/auth-proxy#team-sync-enterprise-only" >}})
- [Azure AD](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/configure-security/configure-authentication/azuread#group-sync-enterprise-only)
- [Generic OAuth integration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/configure-security/configure-authentication/generic-oauth#configure-group-synchronization" >}})
- [GitHub OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/configure-security/configure-authentication/github#configure-group-synchronization)
- [GitLab OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/configure-security/configure-authentication/gitlab#configure-group-synchronization)
- [Google OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/configure-security/configure-authentication/google#configure-group-synchronization)
- [LDAP](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/configure-security/configure-authentication/enhanced-ldap#ldap-group-synchronization)
- [Okta](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/configure-security/configure-authentication/okta#configure-group-synchronization-enterprise-only)
- [SAML](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/configure-security/configure-authentication/saml#configure-group-synchronization)

### Enhanced LDAP integration

With [enhanced LDAP integration]({{< relref "../setup-grafana/configure-security/configure-authentication/enhanced-ldap" >}}), you can set up active LDAP synchronization.

### SAML authentication

[SAML authentication]({{< relref "../setup-grafana/configure-security/configure-authentication/saml" >}}) enables users to authenticate with single sign-on services that use Security Assertion Markup Language (SAML).

### Protected roles

With [protected roles]({{< relref "../setup-grafana/configure-security/configure-authentication#protected-roles" >}}), you can define user roles that are exempt from being converted from one authentication type to another when changing auth providers.

## Enterprise features

Grafana Enterprise adds the following features:

- [Role-based access control]({{< relref "../administration/roles-and-permissions/access-control" >}}) to control access with role-based permissions.
- [Data source permissions]({{< relref "../administration/data-source-management#data-source-permissions" >}}) to restrict query access to specific teams and users.
- [Data source query and resource caching]({{< relref "../administration/data-source-management#query-and-resource-caching" >}}) to temporarily store query results in Grafana to reduce data source load and rate limiting.
- [Reporting]({{< relref "../dashboards/create-reports" >}}) to generate a PDF report from any dashboard and set up a schedule to have it emailed to whomever you choose.
- [Export dashboard as PDF]({{< relref "../dashboards/share-dashboards-panels#export-a-dashboard-as-pdf" >}})
- [Custom branding]({{< relref "../setup-grafana/configure-grafana/configure-custom-branding" >}}) to customize Grafana from the brand and logo to the footer links.
- [Usage insights]({{< relref "../dashboards/assess-dashboard-usage" >}}) to understand how your Grafana instance is used.
- [Recorded queries]({{< relref "../administration/recorded-queries" >}}) to see trends over time for your data sources.
- [Vault integration]({{< relref "../setup-grafana/configure-security/configure-database-encryption#encrypting-your-database-with-a-key-from-a-key-management-service-kms" >}}) to manage your configuration or provisioning secrets with Vault.
- [Auditing]({{< relref "../setup-grafana/configure-security/audit-grafana" >}}) tracks important changes to your Grafana instance to help you manage and mitigate suspicious activity and meet compliance requirements.
- [Request security]({{< relref "../setup-grafana/configure-security/configure-request-security" >}}) makes it possible to restrict outgoing requests from the Grafana server.
- [Settings updates at runtime]({{< relref "../setup-grafana/configure-grafana/settings-updates-at-runtime" >}}) allows you to update Grafana settings at runtime without requiring a restart.

## Enterprise data sources

With a Grafana Enterprise license, you also get access to premium data sources, including:

- [Adobe Analytics](/grafana/plugins/grafana-adobeanalytics-datasource)
- [Amazon Aurora](/grafana/plugins/grafana-aurora-datasource)
- [AppDynamics](/grafana/plugins/dlopes7-appdynamics-datasource)
- [Atlassian Statuspage](/grafana/plugins/grafana-atlassianstatuspage-datasource)
- [Azure CosmosDB](/grafana/plugins/grafana-azurecosmosdb-datasource)
- [Azure Devops](/grafana/plugins/grafana-azuredevops-datasource)
- [Catchpoint](/grafana/plugins/grafana-catchpoint-datasource)
- [Cloudflare](/grafana/plugins/grafana-cloudflare-datasource)
- [CockroachDB](/grafana/plugins/grafana-cockroachdb-datasource)
- [Databricks](/grafana/plugins/grafana-databricks-datasource)
- [DataDog](/grafana/plugins/grafana-datadog-datasource)
- [Drone](/grafana/plugins/grafana-drone-datasource)
- [DynamoDB](/grafana/plugins/grafana-dynamodb-datasource/)
- [Dynatrace](/grafana/plugins/grafana-dynatrace-datasource)
- [Gitlab](/grafana/plugins/grafana-gitlab-datasource)
- [Grafana Enterprise Logs](/grafana/plugins/grafana-enterprise-logs-app/)
- [Grafana Enterprise Metrics](/grafana/plugins/grafana-metrics-enterprise-app/)
- [Grafana Enterprise Traces](/grafana/plugins/grafana-enterprise-traces-app/)
- [Honeycomb](/grafana/plugins/grafana-honeycomb-datasource)
- [Jira](/grafana/plugins/grafana-jira-datasource)
- [Looker](/grafana/plugins/grafana-looker-datasource/)
- [MongoDB](/grafana/plugins/grafana-mongodb-datasource)
- [Netlify](/grafana/plugins/grafana-netlify-datasource)
- [New Relic](/grafana/plugins/grafana-newrelic-datasource)
- [Oracle Database](/grafana/plugins/grafana-oracle-datasource)
- [PagerDuty](/grafana/plugins/grafana-pagerduty-datasource)
- [Salesforce](/grafana/plugins/grafana-salesforce-datasource)
- [SAP HANA®](/grafana/plugins/grafana-saphana-datasource)
- [ServiceNow](/grafana/plugins/grafana-servicenow-datasource)
- [Snowflake](/grafana/plugins/grafana-snowflake-datasource)
- [Splunk](/grafana/plugins/grafana-splunk-datasource)
- [Splunk Infrastructure monitoring (SignalFx)](/grafana/plugins/grafana-splunk-monitoring-datasource)
- [Sqlyze Datasource](/grafana/plugins/grafana-odbc-datasource)
- [SumoLogic](/grafana/plugins/grafana-sumologic-datasource)
- [Wavefront](/grafana/plugins/grafana-wavefront-datasource)
- [Zendesk](/grafana/plugins/grafana-zendesk-datasource)

## Try Grafana Enterprise

To purchase or obtain a trial license, contact the Grafana Labs [Sales Team](/contact?about=grafana-enterprise-stack).
