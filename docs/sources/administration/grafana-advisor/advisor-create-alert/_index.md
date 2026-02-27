---
title: Create an alert based on Advisor
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
Grafana Advisor is available in [public preview](https://grafana.com/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.

Currently, Grafana Advisor performs regular checks on data sources, plugins, and your Grafana instance, but we're planning to expand its capabilities in future releases to cover more aspects of your Grafana environment. You can suggest new checks and provide feedback through this [form](https://docs.google.com/forms/d/e/1FAIpQLSf8T-xMZauFXZ1uHw09OjZLT_AaiY-cl-hJGwC6Krkj0ThmZQ/viewform).
{{< /admonition >}}

This guide walks you through creating a Grafana alert that monitors Advisor check results and triggers when failures are detected.

Follow these steps:

1. [Create a service account and token](#create-a-service-account-and-token)
1. [Set up the Grafana Infinity data source](#set-up-the-grafana-infinity-data-source)
1. [Create the alert rule](#create-the-alert-rule)
1. [Save the alert rule](#save-the-alert-rule)

## Create a service account and token

1. Navigate to **Administration → Users and access → Service accounts** in your Grafana instance
2. Click **Add service account**
3. Provide a name (for example, "advisor-alert-service-account")
4. Set the role to **Admin** to ensure proper permissions
5. Click **Create**
6. In the service account details, click **Add service account token**
7. Provide a token name and set an appropriate expiration date
8. Click **Generate token**

{{< admonition type="caution" >}}
Copy the token value immediately and store it securely - you won't be able to see it again.
{{< /admonition >}}

## Set up the Grafana Infinity data source

{{< admonition type="note" >}}
Use Infinity plugin v3.3.0 or higher for the JQ parser used later.
{{< /admonition >}}

1. Go to **Connections → Add new connection**
2. Search for "Infinity"
3. If not installed, click **Install**. Wait for the plugin to be installed.
4. From the plugin page, click **Add new data source**.
5. Configure the data source:
   - **Name**: Give it a descriptive name (e.g., "Advisor API")
   - **Setup Authentication**: In the **Auth type**, select **Bearer Token**. In the **Auth details** section, paste the service account token from Step 1 and in the **Allowed hosts** section, write your Grafana app URL and click the "Add" button (e.g., `https://your-grafana-host.com`).
6. Click **Save & test** to verify the connection

## Create the alert rule

Now you have everything you need to create an alert based on Advisor results.

1. Navigate to **Alerting → Alert rules**
2. Click **New alert rule**
3. Provide a rule name (e.g., "Advisor Failures Alert")

### Configure the query

1. **Data source**: Select the Infinity data source created in Step 3
2. Configure the query settings:
   - **Type**: JSON
   - **Parser**: JQ
   - **Source**: URL
   - **Format**: Table
   - **Method**: GET
   - **URL**: Get this from the Advisor interface:
     - Visit the Advisor in your Grafana instance
     - Open browser Developer Tools (F12) → Network tab
     - Look for a request ending with `/checks`
     - Copy the full URL (format: `https://<your_grafana_host>/apis/advisor.grafana.app/v0alpha1/namespaces/<your_namespace>/checks`)

### Configure parsing options

**Rows/Root** (paste this JQ expression):

```jq
.items | map({
  type: .metadata.labels["advisor.grafana.app/type"],
  creationTimestamp: .metadata.creationTimestamp,
  failuresCount: (.status.report.failures | length)
}) | group_by(.type) | map(sort_by(.creationTimestamp) | last)
```

This JQ query processes Grafana Advisor check data to get the most recent result for each check type. It transforms each check into a simplified object with type, timestamp, and failure count.
The result is a clean array showing the current state of each check type (data source, plugin, configuration, etc.) with their failure counts, perfect for alerting when any type has failures > 0.

**Columns** (add these three columns):

- **Selector**: `creationTimestamp`, **Format**: Time
- **Selector**: `failuresCount`, **Format**: Number
- **Selector**: `type`, **Format**: String

### Optional: Filter by check type

If you want to alert only for specific check types:

1. In the **Computed columns, Filter, Group by** section
2. Add a **Filter**: `type == "license"` (replace "license" with your desired check type)

### Set alert condition

- **Alert condition**: Select "WHEN Last OF QUERY Is above 0"
- This will trigger when any check type has failures.
- Click on "Preview alert rule condition" to see the result of the query.

### Complete alert configuration

Select your preferred evaluation (e.g. every 24 hours) and notification settings.

## Save the alert rule

Click **Save** and check the alert is being triggered.

Your alert is now configured to monitor Advisor results and notify you when failures are detected!
