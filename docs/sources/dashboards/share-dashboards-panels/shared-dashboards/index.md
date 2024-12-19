---
aliases:
  - ../dashboard-public/ # /docs/grafana/latest/dashboards/dashboard-public/
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Externally shared dashboards
menuTitle: Shared dashboards
description: Make your Grafana dashboards externally shared and share them with anyone
weight: 8
refs:
  dashboard-sharing:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/share-dashboards-panels/
  custom-branding:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/configure-custom-branding/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/configure-custom-branding/
  dashboard-insights-documentation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/assess-dashboard-usage/#dashboard-insights
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/assess-dashboard-usage/
  caching:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/#query-and-resource-caching
  grafana-enterprise:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/
---

# Externally shared dashboards

{{< admonition type="note" >}}
This feature was previously called **Public dashboards**.
{{< /admonition >}}

Externally shared dashboards allow you to share your Grafana dashboard with anyone. This is useful when you want to make your dashboard available to the world without requiring access to your Grafana organization.

If you change a dashboard, ensure that you save the changes before sharing.

{{< admonition type="warning" >}}
Sharing your dashboard externally could result in a large number of queries to the data sources used by your dashboard.
This can be mitigated by using the Enterprise [caching](ref:caching) and/or rate limiting features.
{{< /admonition >}}

## Shared dashboards list

You can see a list of all your externally shared dashboards in one place by navigating to **Dashboards > Shared dashboards**. For each dashboard in the list, the page displays:

- Link to view the externally shared version of the dashboard
- Link to the shared dashboard configuration
- Options to pause or revoke access to the external dashboard

You can also click the name of the dashboard to navigate to the dashboard internally.

## Important notes about sharing your dashboard externally

- Anyone with the URL can access the dashboard.
- Externally shared dashboards are read-only.
- Arbitrary queries **cannot** be run against your data sources through externally shared dashboards. Externally shared dashboards can only execute the queries stored on the original dashboard.

## Share externally with specific people

{{< admonition type="note">}}
This feature was previously called **email sharing**.

Available in [Grafana Enterprise](ref:grafana-enterprise) and [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

<!-- {{< docs/private-preview product="Sharing externally with specific people" >}}-->

{{< admonition type="note" >}}
Sharing externally with specific people is currently in [private preview](https://grafana.com/docs/release-life-cycle/#private-preview). Please contact support to have this feature enabled.

This feature will incur a cost once it is promoted to general availability.
{{< /admonition >}}

To share a dashboard with specific external users, you can send them a link by email. Use this option when you only want to share your dashboard with specific people. When you share dashboards by email, recipients receive a one-time use link that's valid for **one hour**. Once the link is used, the viewer has access to the shared dashboard for **30 days**.

<!--When you share a dashboard with an email link, your organization is billed per user, regardless of how many dashboards are shared. Grafana bills monthly per user until access is revoked.-->

To share a dashboard with specific people, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down list in the top-right corner and select **Share externally**.

   The **Share externally** drawer opens.

1. In the **Link access** drop-down list, select **Only specific people**.
1. Click the checkbox confirming that you understand payment is required to add users.
1. Click **Accept**.
1. In the **Invite** field, enter the email address of the person you want to invite and click **Invite** and repeat this process for all the people you want to invite.

   You can only invite one person at a time.

1. (Optional) Set the following options:
   - **Enable time range** - Allow people accessing the link to change the time range. This configuration screen shows the default time range of the dashboard.
   - **Display annotations** - Allow people accessing the link to view the dashboard annotations.
1. (Optional) Click **Copy external link** and send the copied URL to any external user.
1. Click the **X** at the top-right corner to close the share drawer.

Once you've shared a dashboard externally, a **Public** label is displayed in the header of the dashboard.

### Viewers requesting access

If a viewer without access tries to navigate to the shared dashboard, they'll be asked to request access by providing their email. They'll receive an email with a new one-time use link if the email they provided has already been invited to view the shared dashboard and hasn't been revoked.

### Revoke access for a viewer

You can revoke access to the entire dashboard using the steps in [Update access to an external dashboard link](#update-access-to-an-external-dashboard-link), but you can also revoke access to the dashboard for specific people.

To revoke access for a viewer, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down list in the top-right corner and select **Share externally**.
1. In the **Share externally** drawer that opens, click the menu icon (three dots) next to the email address of the viewer for whom you'd like to revoke access.
1. Click **Revoke access**.
1. Click the **X** at the top-right corner to close the share drawer.

The viewer immediately no longer has access to the dashboard, nor can they use any existing one-time use links they may have.

### Re-invite a viewer

To re-invite a viewer, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down list in the top-right corner and select **Share externally**.
1. In the **Share externally** drawer that opens, click the menu icon (three dots) next to the email address of the viewer you'd like to invite again.
1. Click **Resend invite**.
1. Click the **X** at the top-right corner to close the share drawer.

The viewer receives an email with a new one-time use link. This invalidates all previously issued links for that viewer.

### View shared dashboard users

To see a list of users who have accessed your externally shared dashboard by way of an emailed link, follow these steps:

1. Click **Administration** in in the main menu.
1. Select **Users and access** > **Users**.
1. On the **Users** page, click the **Shared dashboard users** tab.

On this screen, you can see:

- The earliest time a user has been active in a dashboard
- When they last accessed a shared dashboard
- The dashboards to they have access
- Their role

You can also revoke a user's access to all shared dashboards on from this tab.

### Access limitations

One-time use links use browser cookies, so when a viewer is granted access through one of these links, they'll only have access on the browser they used to claim the link.

A single viewer can't generate multiple valid one-time use links for a dashboard. When a new one-time use link is issued for a viewer, all previous ones are invalidated.

If a Grafana user has read access to the parent dashboard, they can view the externally shared dashboard without needing to have access granted.

## Share externally to anyone with a link

To share your dashboard so that anyone with the link can access it, follow these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down list in the top-right corner and select **Share externally**.

   The **Share externally** drawer opens.

1. In the **Link access** drop-down list, select **Anyone with the link**.
1. Click the checkbox confirming that you understand the entire dashboard will be public.
1. Click **Accept**.
1. (Optional) Set the following options:
   - **Enable time range** - Allow people accessing the link to change the time range. This configuration screen shows the default time range of the dashboard.
   - **Display annotations** - Allow people accessing the link to view the dashboard annotations.
1. Click the **X** at the top-right corner to close the share drawer.

Now anyone with the link can access the dashboard until you pause or revoke access to it.

Once you've shared a dashboard externally, a **Public** label is displayed in the header of the dashboard.

### Update access to an external dashboard link

You can update the access to externally shared dashboard links by following these steps:

1. Click **Dashboards** in the main menu.
1. Click the dashboard you want to share.
1. Click the **Share** drop-down list in the top-right corner and select **Share externally**.
1. In the **Share externally** drawer that opens, do one of the following:
   - Click **Pause access** so that people can't access the dashboard, but the link is maintained.
   - Click **Resume access** so that people can access the dashboard again.
   - Click **Revoke access** so that people can't access the dashboard unless a new external link is generated. Confirm that you want to revoke the link.
1. Click the **X** at the top-right corner to close the share drawer.

## Assess shared dashboard usage

{{< admonition type="note" >}}
Available in [Grafana Enterprise](ref:grafana-enterprise) and [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

You can check usage analytics about your externally shared dashboard by clicking the insights icon in the dashboard header:

![Dashboard insights icon](/media/docs/grafana/dashboards/screenshot-dashboard-insights-icon-11.2.png)

Learn more about the kind of information provided in the [dashboard insights documentation](ref:dashboard-insights-documentation).

## Supported data sources

Externally shared dashboards _should_ work with any data source that has the properties `backend` and `alerting` both set to true in its `plugin.json`. However, this can't always be
guaranteed because plugin developers can override this functionality. The following lists include data sources confirmed to work with externally shared dashboards and data sources that should work, but have not been confirmed as compatible.

### Confirmed

{{< column-list >}}

- ClickHouse
- CloudWatch
- Elasticsearch
- Infinity
- InfluxDB
- Loki
- Microsoft SQL Server
- MongoDB
- MySQL
- Oracle Database
- PostgreSQL
- Prometheus
- Redis
- SQLite

{{< /column-list >}}

### Unsupported

- Graphite
- Dynatrace

### Unconfirmed

{{< column-list >}}

- Altinity plugin for ClickHouse
- Amazon Athena
- Amazon Redshift
- Amazon Timestream
- Apache Cassandra
- AppDynamics
- Azure Data Explorer Datasource
- Azure Monitor
- CSV
- DB2 Datasource
- Databricks
- Datadog
- Dataset
- Druid
- GitHub
- Google BigQuery
- Grafana for YNAB
- Honeycomb
- Jira
- Mock
- Neo4j Datasource
- New Relic
- OPC UA (Unified Architecture)
- Open Distro for Elasticsearch
- OpenSearch
- OpenTSDB
- Orbit
- SAP HANA®
- Salesforce
- Sentry
- ServiceNow
- Snowflake
- Splunk
- Splunk Infrastructure Monitoring
- Sqlyze data source
- TDengine
- Vertica
- Wavefront
- X-Ray
- kdb+
- simple grpc data source

{{< /column-list >}}

## Limitations

- Panels that use frontend data sources will fail to fetch data.
- Variables and queries including variables are not supported.
- Exemplars will be omitted from the panel.
- Only annotations that query the `-- Grafana --` data source are supported.
- Organization annotations are not supported.
- Grafana Live and real-time event streams are not supported.
- Library panels are not supported.
- Data sources using Reverse Proxy functionality are not supported.

## Custom branding

If you're a Grafana Enterprise customer, you can use custom branding to change the appearance of an externally shared dashboard footer. For more information, refer to [Custom branding](ref:custom-branding).
