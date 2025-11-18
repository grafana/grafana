---
keywords:
  - grafana
  - dashboard
  - template
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Create template dashboards
title: Create dashboards from templates
description: Learn how to create dashboards from templates
weight: 3
---

{{< docs/public-preview product="Dashboard templates" >}}

# Create dashboards from templates

Grafana provides a variety of pre-built dashboard templates that you can use to quickly set up visualizations for your data.
These templates are designed to work with specific types of data sources and metrics, making it easier to get started with monitoring and analysis.

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-templates-v12.3.png" max-width="750px" alt="Selection of dashboard templates" >}}

To create a dashboard from a template, follow these steps:

1. Click **Dashboards** in the primary menu.
1. Click **New** and select **Dashboard from template** in the drop-down menu.
1. Select a template.

   The dashboard created includes a banner panel indicating the dashboard is using sample data:

   {{< figure src="/media/docs/grafana/dashboards/screenshot-sample-data-dashboard-v12.3.png" max-width="750px" alt="Dashboard with sample data" >}}

1. Click **Save dashboard** in the top-right corner.
1. Click **Edit**.
1. Update the data source for each panel to add your own data and configure the queries you need.
1. (Optional) Make any other edits to the dashboard to most effectively display your data.
1. When you've made all of your changes, remove the banner panel.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-remove-banner-v12.3.png" max-width="750px" alt="Removing the sample data banner panel" >}}

1. Click **Save dashboard**.
