---
aliases:
  - ../features/dashboard/dashboards/
  - dashboard-manage/
title: Public dashboards
weight: 8
---

# Public dashboards

> **Note:** This is an opt-in alpha feature.

> **Caution:** Making your dashboard public could result in a large number of queries to the datasources used by your dashboard.
> This can be mitigated by utilizing the enterprise [caching](https://grafana.com/docs/grafana/latest/enterprise/query-caching/) and/or rate limiting features.

Public dashboards allow you to share your Grafana dashboard with anyone. This is useful when you want to expose your
dashboard to the world.

## Security implications of making your dashboard public

- Anyone with the URL can access the dashboard.
- Public dashboards are read-only.
- Arbitrary queries **cannot** be run against your datasources through public dashboards. Public dashboards can only execute the
  queries stored on the original dashboard.

## Enable the feature

Add the `publicDashboards` feature toggle to your `custom.ini` file.

```
[feature_toggles]
publicDashboards = true
```

If you are using Docker, use an environment variable to enable public dashboards:

```
--env GF_FEATURE_TOGGLES_ENABLE=publicDashboards
```

> **Note:** For Grafana Cloud, contact support to have the feature enabled.

## Make a dashboard public

1. Click the sharing icon to the right of the dashboard title.
1. Click the **Public dashboard** tab.
1. Acknowledge the implications of making the dashboard public by checking all the checkboxes.
1. Click **Generate public URL** to make the dashboard public and make your link live.
1. Copy the public dashboard link if you'd like to share it. You can always come back later for it.

## Pause access

1. Click the sharing icon to the right of the dashboard title.
1. Click the **Public dashboard** tab.
1. Enable the **Pause sharing dashboard** toggle.

The dashboard is no longer accessible, even with the link, until you make it shareable again.

## Revoke access

1. Click the sharing icon to the right of the dashboard title.
1. Click the **Public dashboard** tab.
1. Click **Revoke public URL** to delete the public dashboard.

The link no longer works. You must create a new public URL as in [Make a dashboard public](#make-a-dashboard-public).

## Email sharing

> **Note:** Available in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}) and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud).

Email sharing allows you to share your public dashboard with only specific people via email, instead of having it accessible to anyone with the URL.

### Enable email sharing

> **Note:** For Grafana Cloud, contact support to have the feature enabled.

Add the `publicDashboardsEmailSharing` feature toggle to your `custom.ini` file.

```
[feature_toggles]
publicDashboardsEmailSharing = true
```

### Invite a viewer

1. Click the sharing icon to the right of the dashboard title.
1. Click the **Public dashboard** tab.
1. Click **Only specified people**.
1. Enter the email you want to share the public dashboard with.
1. Click **Invite**.
1. The recipient(s) will receive an email with a one-time use link. This link must be used within **one hour** or it expires. Once the link is used, the viewer has access to the public dashboard for **30 days**.

### Viewers requesting access

If a viewer without access tries to navigate to the public dashboard, they'll be asked to request access by providing their email. They will receive an email with a new one-time use link if the email they provided has already been invited to view the public dashboard and has not been revoked.

If the viewer doesn't have an invitation or it's been revoked, you won't be notified and no link is sent.

### Revoke access for a viewer

1. Click the sharing icon to the right of the dashboard title.
1. Click the **Public dashboard** tab.
1. Click **Revoke** on the viewer you'd like to revoke access for.

Immediately, the viewer no longer has access to the public dashboard, nor can they use any existing one-time use links they may have.

### Reinvite a viewer

1. Click the sharing icon to the right of the dashboard title.
1. Click the **Public dashboard** tab.
1. Click **Resend** on the viewer you'd like to re-share the public dashboard with.

The viewer will receive an email with a new one-time use link. This will invalidate all previously issued links for that viewer.

### Access limitations

One-time use links use browser cookies, so when a viewer is granted access via one of these links, they will only have access through the browser they used to claim the link.

A single viewer cannot generate multiple valid one-time use links. When a new one-time use link is issued for a viewer, all previous ones are invalidated.

If a Grafana user has read access to the parent dashboard, they can view the public dashboard without needing to have access granted.

## Supported data sources

Public dashboards _should_ work with any datasource that has the properties `backend` and `alerting` both set to true in it's `package.json`. However, this cannot always be
guaranteed because plugin developers can override this functionality. The following lists include data sources confirmed to work with public dashboards and data sources that should work but have not been confirmed as compatible.

### Confirmed:

<table>
  <tr>
    <td>
      <ul>
        <li>Altinity plugin for ClickHouse</li>
        <li>ClickHouse</li>
        <li>Elasticsearch</li>
        <li>Graphite</li>
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
        <li>OpenTSDB</li>
        <li>Oracle Database</li>
        <li>PostgreSQL</li>
        <li>Prometheus</li>
        <li>Redis</li>
        <li>SQLite</li>
      </ul>
    </td>
  </tr>
</table>

### Unconfirmed:

> **Note:** If you've confirmed one of these datasources work with public dashboards, let us know in our [Github](https://github.com/grafana/grafana/discussions/49253) discussion, and we'll mark it as confirmed!

<table>
  <tr>
    <td>
      <ul>
        <li>Amazon Athena</li>
        <li>Amazon Redshift</li>
        <li>Amazon Timestream</li>
        <li>Apache Cassandra</li>
        <li>AppDynamics</li>
        <li>Azure Data Explorer Datasource</li>
        <li>Azure Monitor</li>
        <li>CSV</li>
        <li>CloudWatch</li>
        <li>DB2 Datasource</li>
        <li>Databricks</li>
        <li>Datadog</li>
        <li>Dataset</li>
        <li>Druid</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Dynatrace</li>
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
        <li>Orbit</li>
        <li>SAP HANA®</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Salesforce</li>
        <li>Sentry</li>
        <li>ServiceNow</li>
        <li>Snowflake</li>
        <li>Splunk</li>
        <li>Splunk Infrastructure Monitoring</li>
        <li>Sqlyze Datasource</li>
        <li>TDengine</li>
        <li>Vertica</li>
        <li>Wavefront</li>
        <li>X-Ray</li>
        <li>kdb+</li>
        <li>simple grpc datasource</li>
      </ul>
    </td>
  </tr>
</table>

## Limitations

- Panels that use frontend datasources will fail to fetch data.
- Template variables are currently not supported, but are planned to be in the future.
- Exemplars will be omitted from the panel.
- Only annotations that query the `-- Grafana --` datasource are supported.
- Organization annotations are not supported.
- Grafana Live and real-time event streams are not supported.
- Library panels are currently not supported, but are planned to be in the future.
- Datasources using Reverse Proxy functionality are not supported.

We are excited to share this enhancement with you and we’d love your feedback! Please check out the [Github](https://github.com/grafana/grafana/discussions/49253) discussion and join the conversation.

## Custom branding

If you are a Grafana Enterprise customer, you can use custom branding to change the appearance of a public dashboard footer. For more information, refer to [Custom branding](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/configure-custom-branding/).
