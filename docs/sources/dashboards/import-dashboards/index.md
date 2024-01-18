---
aliases:
  - ../features/dashboard/dashboards/
  - ../panels/working-with-panels/organize-dashboard/
  - ../reference/dashboard_folders/
  - ../reference/export_import/
  - ../reference/timerange/
  - ../troubleshooting/troubleshoot-dashboards/
  - dashboard-folders/
  - dashboard-manage/
  - export-import/
keywords:
  - grafana
  - dashboard
  - dashboard folders
  - folder
  - folders
  - import
  - export
  - troubleshoot
  - time range
  - scripting
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Import dashboards
title: Import dashboards
description: Learn about dashboard folders, generative AI features for dashboards, and troubleshooting
weight: 8
---

# Import dashboards

You can use the Grafana UI or the [HTTP API][] to export and import dashboards.

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

## Import a dashboard

1. Click **Dashboards** in the left-side menu.
1. Click **New** and select **Import** in the dropdown menu.
1. Perform one of the following steps:

   - Upload a dashboard JSON file
   - Paste a [Grafana.com](https://grafana.com) dashboard URL
   - Paste dashboard JSON text directly into the text area

The import process enables you to change the name of the dashboard, pick the data source you want the dashboard to use, and specify any metric prefixes (if the dashboard uses any).

## Discover dashboards on grafana.com

Find dashboards for common server applications at [Grafana.com/dashboards](https://grafana.com/dashboards).

{{< figure src="/media/docs/grafana/dashboards/screenshot-gcom-dashboards.png" alt="Preconfigured dashboards on grafana.com">}}

{{% docs/reference %}}
[Dashboard permissions]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions#dashboard-permissions"
[Dashboard permissions]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions#dashboard-permissions"

[panels]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/panels-visualizations"
[panels]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/visualizations/panels-visualizations"

[HTTP API]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/developers/http_api"
[HTTP API]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/developer-resources/api-reference/http-api"

[Grafana LLM plugin documentation]: "/docs/grafana/ -> /docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin"
[Grafana LLM plugin documentation]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin"
{{% /docs/reference %}}
