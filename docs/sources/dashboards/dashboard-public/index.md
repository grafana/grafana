---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Public dashboards
description: Make your Grafana dashboards public and share them with anyone
weight: 350
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

# Public dashboards

> **Warning:** Making your dashboard public could result in a large number of queries to the data sources used by your dashboard.
> This can be mitigated by utilizing the enterprise [caching](ref:caching) and/or rate limiting features.

Public dashboards allow you to share your Grafana dashboard with anyone. This is useful when you want to make your dashboard available to the world without requiring access to your Grafana organization. This differs from [dashboard sharing](ref:dashboard-sharing), which either requires recipients to be users in the same Grafana organization or provides limited information, as with a snapshot.

You can see a list of all your public dashboards in one place by navigating to **Dashboards > Public dashboards**. For each dashboard in the list, the page displays the status, a link to view the dashboard, a link to the public dashboard configuration, and the option to revoke the public URL.

## Security implications of making your dashboard public

- Anyone with the URL can access the dashboard.
- Public dashboards are read-only.
- Arbitrary queries **cannot** be run against your data sources through public dashboards. Public dashboards can only execute the
  queries stored on the original dashboard.

## Make a dashboard public

1. Click **Share** in the top-right corner of the dashboard.
1. Click the **Public dashboard** tab.
1. Acknowledge the implications of making the dashboard public by selecting all the checkboxes.
1. Click **Generate public URL** to make the dashboard public and make your link live.
1. Copy the public dashboard link if you'd like to share it. You can always come back later for it.

Once you've made the dashboard public, a **Public** tag is displayed in the header of the dashboard.

## Pause access

1. Click **Share** in the top-right corner of the dashboard.
1. Click the **Public dashboard** tab.
1. Enable the **Pause sharing dashboard** toggle.

The dashboard is no longer accessible, even with the link, until you make it shareable again.

## Revoke access

1. Click **Share** in the top-right corner of the dashboard.
1. Click the **Public dashboard** tab.
1. Click **Revoke public URL** to delete the public dashboard.

The link no longer works. You must create a new public URL, as in [Make a dashboard public](#make-a-dashboard-public).

## Email sharing

{{% admonition type="note" %}}

Available in [private preview](/docs/release-life-cycle/) in [Grafana Cloud](/docs/grafana-cloud). This feature will have a cost by active users after being promoted into general availability.

Please contact support to have the feature enabled.

{{% /admonition %}}

Email sharing allows you to share your public dashboard with only specific people by email, instead of having it accessible to anyone with the URL. When you use email sharing, recipients receive a one-time use link that's valid for **one hour**. Once the link is used, the viewer has access to the public dashboard for **30 days**.

### Invite a viewer

1. Click **Share** in the top-right corner of the dashboard.
1. Click the **Public dashboard** tab.
1. Acknowledge the implications of making the dashboard public by selecting all the checkboxes.
1. Click **Generate public URL** to make the dashboard public and make your link live.
1. Under Can view dashboard, click **Only specified people**.
1. Enter the email you want to share the public dashboard with.
1. Click **Invite**.
1. The recipient will receive an email with a one-time use link.

### Viewers requesting access

If a viewer without access tries to navigate to the public dashboard, they'll be asked to request access by providing their email. They will receive an email with a new one-time use link if the email they provided has already been invited to view the public dashboard and has not been revoked.

If the viewer doesn't have an invitation or it's been revoked, you won't be notified and no link is sent.

### Revoke access for a viewer

1. Click **Share** in the top-right corner of the dashboard.
1. Click the **Public dashboard** tab.
1. Click **Revoke** on the viewer you'd like to revoke access for.

Immediately, the viewer no longer has access to the public dashboard, nor can they use any existing one-time use links they may have.

### Reinvite a viewer

1. Click **Share** in the top-right corner of the dashboard.
1. Click the **Public dashboard** tab.
1. Click **Resend** on the viewer you'd like to re-share the public dashboard with.

The viewer will receive an email with a new one-time use link. This will invalidate all previously issued links for that viewer.

### View public dashboard users

To see a list of users who have accessed your dashboard by way of email sharing, take the following steps:

1. In the main sidebar navigation, click **Administration**.
1. Click **Users**.
1. Click the **Public dashboard users** tab.

From here, you can see the earliest time a user has been active in a dashboard, which public dashboards they have access to, and their role.

### Access limitations

One-time use links use browser cookies, so when a viewer is granted access through one of these links, they will only have access on the browser they used to claim the link.

A single viewer cannot generate multiple valid one-time use links. When a new one-time use link is issued for a viewer, all previous ones are invalidated.

If a Grafana user has read access to the parent dashboard, they can view the public dashboard without needing to have access granted.

## Assess public dashboard usage

> **Note:** Available in [Grafana Enterprise](ref:grafana-enterprise) and [Grafana Cloud](/docs/grafana-cloud).

You can check usage analytics about your public dashboard by clicking the insights icon in the dashboard header:

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-insights-11.2.png" max-width="400px" class="docs-image--no-shadow" alt="Dashboard insights icon" >}}

Learn more about the kind of information provided in the [dashboard insights documentation](ref:dashboard-insights-documentation).

## Supported data sources

Public dashboards _should_ work with any data source that has the properties `backend` and `alerting` both set to true in its `plugin.json`. However, this can't always be
guaranteed because plugin developers can override this functionality. The following lists include data sources confirmed to work with public dashboards and data sources that should work, but have not been confirmed as compatible.

### Confirmed:

<table>
  <tr>
    <td>
      <ul>
        <li>ClickHouse</li>
        <li>CloudWatch</li>
        <li>Elasticsearch</li>
        <li>Infinity</li>
        <li>InfluxDB</li>
        <li>Loki</li>
        <li>Microsoft SQL Server</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>MongoDB</li>
        <li>MySQL</li>
        <li>Oracle Database</li>
        <li>PostgreSQL</li>
        <li>Prometheus</li>
        <li>Redis</li>
        <li>SQLite</li>
      </ul>
    </td>
  </tr>
</table>

### Unsupported:

<table>
  <tr>
    <td>
      <ul>
        <li>DynamoDB</li>
        <li>Dynatrace</li>
        <li>Graphite</li>
        <li>Google Sheets</li>
      </ul>
    </td>
  </tr>
</table>

### Unconfirmed:

<table>
  <tr>
    <td>
      <ul>
        <li>Altinity plugin for ClickHouse</li>
        <li>Amazon Athena</li>
        <li>Amazon Redshift</li>
        <li>Amazon Timestream</li>
        <li>Apache Cassandra</li>
        <li>AppDynamics</li>
        <li>Azure Data Explorer Datasource</li>
        <li>Azure Monitor</li>
        <li>CSV</li>
        <li>DB2 Datasource</li>
        <li>Databricks</li>
        <li>Datadog</li>
        <li>Dataset</li>
        <li>Druid</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>GitHub</li>
        <li>Google BigQuery</li>
        <li>Grafana for YNAB</li>
        <li>Honeycomb</li>
        <li>Jira</li>
        <li>Mock</li>
        <li>Neo4j Datasource</li>
        <li>New Relic</li>
        <li>OPC UA (Unified Architecture)</li>
        <li>Open Distro for Elasticsearch</li>
        <li>OpenSearch</li>
        <li>OpenTSDB</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Orbit</li>
        <li>SAP HANA®</li>
        <li>Salesforce</li>
        <li>Sentry</li>
        <li>ServiceNow</li>
        <li>Snowflake</li>
        <li>Splunk</li>
        <li>Splunk Infrastructure Monitoring</li>
        <li>Sqlyze data source</li>
        <li>TDengine</li>
        <li>Vertica</li>
        <li>Wavefront</li>
        <li>X-Ray</li>
        <li>kdb+</li>
        <li>simple grpc data source</li>
      </ul>
    </td>
  </tr>
</table>

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

If you're a Grafana Enterprise customer, you can use custom branding to change the appearance of a public dashboard footer. For more information, refer to [Custom branding](ref:custom-branding).
