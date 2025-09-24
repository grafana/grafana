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

Building on everything you already know and love about Grafana open source, Grafana Enterprise includes [exclusive data source plugins](#enterprise-data-sources) and [additional features](#enterprise-features). You also get 24x7x365 support and training from the core Grafana team.

To learn more about Grafana Enterprise, refer to [our product page](/enterprise).

## Enterprise features in Grafana Cloud

Many Grafana Enterprise features are also available in paid [Grafana Cloud](/docs/grafana-cloud) accounts. For details, refer to [Grafana Cloud features](/docs/grafana-cloud/introduction/understand-grafana-cloud-features/). For pricing and plans, refer to [Grafana Cloud pricing](https://grafana.com/pricing/).

To migrate to Grafana Cloud, refer to [Migrate from Grafana Enterprise to Grafana Cloud](/docs/grafana/<GRAFANA_VERSION>/administration/migration-guide/)

## Authentication

Grafana Enterprise includes integrations with more ways to authenticate your users and enhanced authentication capabilities.

### Team sync

[Team sync](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-team-sync/) allows you to set up synchronization between teams in Grafana and teams in your auth provider so that your users automatically end up in the right team.

Supported auth providers:

- [Auth Proxy](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/auth-proxy#team-sync-enterprise-only)
- [Azure AD OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/#team-sync-enterprise-only)
- [GitHub OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/github/#configure-team-synchronization)
- [Generic OAuth integration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/generic-oauth/#configure-team-synchronization)
- [GitLab OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/gitlab/#configure-team-synchronization)
- [Google OAuth](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/google/#configure-team-synchronization)
- [LDAP](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/enhanced-ldap/#ldap-group-synchronization-for-teams)
- [Okta](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/okta#configure-team-synchronization-enterprise-only)
- [SAML](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/saml#configure-team-sync)

### Enhanced LDAP integration

With [enhanced LDAP integration](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/enhanced-ldap/), you can set up active LDAP synchronization.

### SAML authentication

[SAML authentication](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/saml/) enables users to authenticate with single sign-on services that use Security Assertion Markup Language (SAML).

### Protected roles

With [protected roles](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/#protected-roles), you can define user roles that are exempt from being converted from one authentication type to another when changing auth providers.

## Enterprise features

Grafana Enterprise adds the following features:

- [Role-based access control](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/) to control access with role-based permissions.
- [Data source permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#data-source-permissions) to restrict query access to specific teams and users.
- [Data source query and resource caching](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching) to temporarily store query results in Grafana to reduce data source load and rate limiting.
- [Reporting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/create-reports/) to generate a PDF report from any dashboard and set up a schedule to have it emailed to whomever you choose.
- [Export dashboard as PDF](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/#export-a-dashboard-as-pdf)
- [Custom branding](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/configure-custom-branding/) to customize Grafana from the brand and logo to the footer links.
- [Usage insights](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/assess-dashboard-usage/) to understand how your Grafana instance is used.
- [Recorded queries](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/) to see trends over time for your data sources.
- [Vault integration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-database-encryption/#encrypting-your-database-with-a-key-from-a-key-management-service-kms) to manage your configuration or provisioning secrets with Vault.
- [Auditing](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/audit-grafana/) tracks important changes to your Grafana instance to help you manage and mitigate suspicious activity and meet compliance requirements.
- [Request security](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-request-security/) makes it possible to restrict outgoing requests from the Grafana server.
- [Settings updates at runtime](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/settings-updates-at-runtime/) allows you to update Grafana settings at runtime without requiring a restart.

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
- [LogicMonitor Devices](/grafana/plugins/grafana-logicmonitor-datasource/)
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
