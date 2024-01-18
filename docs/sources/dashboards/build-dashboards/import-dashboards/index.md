---
aliases:
  - ../reference/export_import/
  - export-import/
keywords:
  - grafana
  - dashboard
  - import
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Import dashboards
title: Import dashboards
description: Learn how to import dashboards and about Grafana's preconfigured dashboards
weight: 5
---

# Import dashboards

You can import preconfigured dashboards into your Grafana instance or Cloud stack using the UI or the or the [HTTP API][].

## Import a dashboard

To import a dashboard, follow these steps:

1. Click **Dashboards** in the left-side menu.
1. Click **New** and select **Import** in the dropdown menu.
1. Perform one of the following steps:

   - Upload a dashboard JSON file
   - Paste a [Grafana.com](https://grafana.com) dashboard URL
   - Paste dashboard JSON text directly into the text area

The import process enables you to change the name of the dashboard, pick the data source you want the dashboard to use, and specify any metric prefixes (if the dashboard uses any).

## Discover dashboards on grafana.com

Find dashboards for common server applications on our [Dashboards page](https://grafana.com/grafana/dashboards/).

{{< figure src="/media/docs/grafana/dashboards/screenshot-gcom-dashboards.png" alt="Preconfigured dashboards on grafana.com">}}

<!-- not sure about this content

### Export a dashboard

The dashboard export action creates a Grafana JSON file that contains everything you need, including layout, variables, styles, data sources, queries, and so on, so that you can later import the dashboard.

1. Click **Dashboards** in the main menu.
1. Open the dashboard you want to export.
1. Click the **Share** icon in the top navigation bar.
1. Click **Export**.

   If you're exporting the dashboard to use in another instance, with different data source UIDs, enable the **Export for sharing externally** switch.

1. Click **Save to file**.

Grafana downloads a JSON file to your local machine.

#### Make a dashboard portable

If you want to export a dashboard for others to use, you can add template variables for things like a metric prefix (use a constant variable) and server name.

A template variable of the type `Constant` is automatically hidden in the dashboard, and is also added as a required input when the dashboard is imported. -->

{{% docs/reference %}}
[HTTP API]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/developers/http_api"
[HTTP API]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/developer-resources/api-reference/http-api"
{{% /docs/reference %}}
