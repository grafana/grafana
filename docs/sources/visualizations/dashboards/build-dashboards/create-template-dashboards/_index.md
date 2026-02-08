---
keywords:
  - grafana
  - dashboard
  - template
  - suggestions
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Create template and suggested dashboards
title: Create dashboards from templates and suggestions
description: Learn how to create dashboards from templates and suggestions
weight: 3
---

# Create dashboards from templates and suggestions

Grafana provides alternative ways to start building a dashboard.

## Create dashboards from templates

{{< docs/public-preview product="Dashboard templates" >}}

Grafana provides a variety of pre-built dashboard templates that you can use to quickly set up visualizations for your data. These dashboards use sample data, which you can replace with your own data, making it easier to get started with monitoring and analysis.

The templates provide standardized dashboard layouts designed to help you answer engineering or business questions consistently. For instance, the DORA template allows all teams within an organization to measure delivery performance using a widely adopted industry framework.

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-templates-v12.4.png" max-width="750px" alt="Selection of dashboard templates" >}}

To create a dashboard from a template, follow these steps:

1. Click **Dashboards** in the primary menu.
1. Click **New** and select **Dashboard from template** in the drop-down menu.
1. Select a template.

   The dashboard created includes a banner panel indicating the dashboard is using sample data:

   {{< figure src="/media/docs/grafana/dashboards/screenshot-sample-data-dashboard-v12.3.png" max-width="750px" alt="Dashboard with sample data" >}}

1. Click **Save dashboard** in the top-right corner.
1. Click **Edit**.
1. Update the data source for each panel to add your own data and configure the queries you need.

   In Grafana Cloud, you also have the option to [customize the template using Grafana Assistant](#customize-templates-with-grafana-assistant).

1. Make any other edits to the dashboard to most effectively display your data.
1. When you've made all of your changes, remove the banner panel.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-remove-banner-v12.3.png" max-width="750px" alt="Removing the sample data banner panel" >}}

1. Click **Save dashboard**.

### Customize templates with Grafana Assistant

In Grafana Cloud, you can customize a dashboard template using Grafana Assistant.
When you choose this option, a preconfigured prompt is entered into the Assistant chat to start the process:

{{< figure src="/media/docs/grafana/dashboards/screenshot-dash-template-w-assist-v12.4.png" max-width="750px" alt="Grafana Assistant helping create a dashboard from template" >}}

Grafana Assistant analyses the template, checks your available data sources, and guides the creation of a dashboard tailored to your environment.
This lets create a working, relevant dashboard from a template without the need to manually map metrics and panels.

## Create dashboards from suggestions

{{< docs/public-preview product="Suggested dashboards" >}}

You can start the process of creating a dashboard directly from a data source rather than from the **Dashboards** page, which gives you access to suggestions based on the data source.

To begin building a dashboard directly from a data source, follow these steps:

1. Navigate to **Connections > Data sources**.
1. On the row of the data source for which you want to build a dashboard, click **Build a dashboard**.

   The empty dashboard page opens.

1. Select one of the suggested dashboards by clicking its **Use dashboard** button. This can be helpful when you're not sure how to most effectively visualize your data.
   The suggested dashboards are specific to your data source type (for example, Prometheus, Loki, or Elasticsearch). If there are more than three dashboard suggestions, you can click **View all** to see the rest of them.

   ![Empty dashboard with add visualization and suggested dashboard options](/media/docs/grafana/dashboards/screenshot-suggested-dashboards-v12.3.png)

1. Complete the rest of the dashboard configuration. For more detailed steps, refer to [Create a dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/), beginning at step five.
