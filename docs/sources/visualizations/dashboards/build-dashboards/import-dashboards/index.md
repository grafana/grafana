---
aliases:
  - ../../../reference/export_import/ # /docs/grafana/next/reference/export_import/
  - ../../../dashboards/export-import/ # /docs/grafana/next/dashboards/export-import/
  - ../../../dashboards/build-dashboards/import-dashboards/ # /docs/grafana/next/dashboards/build-dashboards/import-dashboards/
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
---

# Import dashboards

You can import preconfigured dashboards into your Grafana instance or Cloud stack using the UI or the [HTTP API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/).

## Import a dashboard

To import a dashboard, follow these steps:

1. Click **Dashboards** in the primary menu.
1. Click **New** and select **Import dashboard** in the drop-down menu.
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

You can also add to this library by exporting one of your own dashboards. For more information, refer to [Share dashboards and panels](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/share-dashboards-panels/).

## More examples

Your Grafana Cloud stack comes with several default dashboards in the **Grafana Cloud** folder in **Dashboards**. If you're running your own installation of Grafana, you can find more example dashboards in the `public/dashboards/` directory.

## Frequently asked questions

{{< qa-list >}}
{{< qa question="Where can I find dashboards to import?" >}}
Grafana.com provides a library of official and community-created dashboards for common technologies and applications.
You can browse the library, copy a dashboard's URL or ID, and import it directly into your Grafana instance.
{{< /qa >}}
{{< qa question="Why do I need to select a data source when importing a dashboard?" >}}
Many imported dashboards contain queries that reference a data source.
During import, Grafana lets you map those references to data sources that exist in your environment so the dashboard can display data correctly.
{{< /qa >}}
{{< qa question="Can I import dashboards into both Grafana Cloud and self-managed Grafana?" >}}
Yes.
Dashboard import is supported in both Grafana Cloud and self-managed Grafana.
Regardless of where your Grafana instance is running, you can import dashboards from a JSON file, by pasting dashboard JSON, or by using a dashboard URL or ID from Grafana.com.
{{< /qa >}}
{{< /qa-list >}}
