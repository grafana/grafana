---
title: Create an alert based on Grafana Advisor results
menuTitle: Create an alert based on Advisor
description: Create an alert based on the results from Grafana Advisor
weight: 200
labels:
  products:
    - oss
    - cloud
    - enterprise
keywords:
  - grafana
  - grafana advisor
  - monitoring
  - instance health
  - alerts
---

# Create an alert based on Grafana Advisor results

{{< admonition type="note" >}}
Grafana Advisor performs regular checks on data sources, plugins, and your Grafana instance, and will expand its capabilities in future releases to cover more aspects of your Grafana environment. You can suggest new checks and provide feedback through this [form](https://docs.google.com/forms/d/e/1FAIpQLSf8T-xMZauFXZ1uHw09OjZLT_AaiY-cl-hJGwC6Krkj0ThmZQ/viewform).
{{< /admonition >}}

This guide explains how to create a Grafana alert that monitors Advisor check results and fires when Advisor detects failures.

To create the alert, complete the following steps:

1. [Create a service account and token](#create-a-service-account-and-token)
1. [Set up the Grafana Infinity data source](#set-up-the-grafana-infinity-data-source)
1. [Create the alert rule](#create-the-alert-rule)
1. [Save the alert rule](#save-the-alert-rule)

## Create a service account and token

Advisor results are available through the Advisor HTTP API. To query the API, create a service account and a token:

1. In your Grafana instance, go to **Administration** > **Users and access** > **Service accounts**.
1. Click **Add service account**.
1. Enter a name, for example `advisor-alert-service-account`.
1. Set the role to **Admin** to ensure the service account has the required permissions.
1. Click **Create**.
1. In the service account details, click **Add service account token**.
1. Enter a token name and set an expiration date.
1. Click **Generate token**.

{{< admonition type="caution" >}}
Copy the token value immediately and store it securely. You can't view it again.
{{< /admonition >}}

## Set up the Grafana Infinity data source

The Grafana Infinity data source queries the Advisor HTTP API using the service account token.

{{< admonition type="note" >}}
Use Infinity plugin v3.3.0 or later, which supports the JQ parser used in this guide.
{{< /admonition >}}

1. Go to **Connections** > **Add new connection**.
1. Search for `Infinity`.
1. If the plugin isn't installed, click **Install** and wait for the installation to finish.
1. On the plugin page, click **Add new data source**.
1. Configure the data source:
   - **Name:** Enter a descriptive name, for example `Advisor API`.
   - **Authentication:** In **Auth type**, select **Bearer Token**. In the **Auth details** section, paste the service account token you created. In the **Allowed hosts** section, enter your Grafana URL, for example `https://your-grafana-host.com`, and click **Add**.
1. Click **Save & test** to verify the connection.

## Create the alert rule

After you set up the data source, create an alert rule based on Advisor results:

1. Go to **Alerting** > **Alert rules**.
1. Click **New alert rule**.
1. Enter a rule name, for example `Advisor failures alert`.

### Configure the query

Configure the query to retrieve the Advisor checks:

1. In **Data source**, select the Infinity data source you set up.
1. Configure the query settings:
   - **Type:** JSON
   - **Parser:** JQ
   - **Source:** URL
   - **Format:** Table
   - **Method:** GET
   - **URL:** `https://<GRAFANA_HOST>/apis/advisor.grafana.app/v0alpha1/namespaces/<NAMESPACE>/checks`

Replace the following placeholders in the URL:

- _`<GRAFANA_HOST>`_: The host of your Grafana instance.
- _`<NAMESPACE>`_: The namespace of your Grafana instance. Check how to get the namespace of your instance in the [namespace API reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/#namespace-namespace).

For more information about this endpoint, refer to the [Advisor HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/advisor/).

### Configure parsing options

In **Rows/Root**, paste the following JQ expression:

```jq
.items | map({
  type: .metadata.labels["advisor.grafana.app/type"],
  creationTimestamp: .metadata.creationTimestamp,
  failuresCount: (.status.report.failures | length)
}) | group_by(.type) | map(sort_by(.creationTimestamp) | last)
```

This expression returns the most recent result for each check type. It transforms each check into an object with the check type, timestamp, and failure count, and keeps the latest check of each type. The result shows the current state of each check type, such as data sources, plugins, or configuration, with its failure count. You can use it to alert when any check type has more than 0 failures.

In **Columns**, add the following columns:

- **Selector:** `creationTimestamp`, **Format:** Time
- **Selector:** `failuresCount`, **Format:** Number
- **Selector:** `type`, **Format:** String

### Filter by check type

Optionally, you can alert only on specific check types:

1. Go to the **Computed columns, Filter, Group by** section.
1. Add a **Filter**, for example `type == "license"`. Replace `license` with the check type you want to alert on.

### Set the alert condition

Set the condition that fires the alert:

1. In **Alert condition**, select **WHEN Last OF QUERY Is above 0**. The alert fires when any check type has failures.
1. Click **Preview alert rule condition** to view the result of the query.

### Complete the alert configuration

Select your preferred evaluation behavior, for example every 24 hours, and configure the notification settings.

## Save the alert rule

Click **Save** and verify that the alert fires as expected.

Your alert now monitors Advisor results and notifies you when Advisor detects failures.
