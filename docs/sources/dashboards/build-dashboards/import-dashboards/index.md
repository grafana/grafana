---
aliases:
  - ../../reference/export_import/ # /docs/grafana/<GRAFANA_VERSION>/reference/export_import/
  - ../export-import/ # /docs/grafana/<GRAFANA_VERSION>/dashboards/export-import/
canonical: https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/import-dashboards/
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
refs:
  share-dashboards-and-panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/share-dashboards-panels/
  http-api:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/developers/http_api/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/developer-resources/api-reference/http-api/
---

# Import dashboards

You can import preconfigured dashboards into your Grafana instance or Cloud stack using the UI or the [HTTP API](ref:http-api).

## Import a dashboard

To import a dashboard, follow these steps:

1. Click **Dashboards** in the primary menu.
1. Click **New** and select **Import** in the drop-down menu.
1. Perform one of the following steps:

   - Upload a dashboard JSON file.
   - Paste a [Grafana.com dashboard](#discover-dashboards-on-grafanacom) URL or ID into the field provided.
   - Paste dashboard JSON text directly into the text area.

1. (Optional) Change the dashboard name, folder, or UID, and specify metric prefixes, if the dashboard uses any.
1. Select a data source, if required.
1. Click **Import**.

## Discover dashboards on grafana.com

The [Dashboards page](https://grafana.com/grafana/dashboards/) on grafana.com provides you with dashboards for common server applications. Browse our library of official and community-built dashboards and import them to quickly get up and running.

{{< figure src="/media/docs/grafana/dashboards/screenshot-gcom-dashboards.png" alt="Preconfigured dashboards on grafana.com">}}

You can also add to this library by exporting one of your own dashboards. For more information, refer to [Share dashboards and panels](ref:share-dashboards-and-panels).

## More examples

Your Grafana Cloud stack comes with several default dashboards in the **Grafana Cloud** folder in **Dashboards**. If you're running your own installation of Grafana, you can find more example dashboards in the `public/dashboards/` directory.
