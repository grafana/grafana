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
title: Create dashboards from templates and suggestions
description: Learn how to create dashboards from templates and suggestions.
weight: 3
---

# Create dashboards from templates and suggestions

Grafana provides alternative ways to start building a dashboard with templates and suggested dashboards.

## Dashboard templates

{{< docs/public-preview product="Dashboard templates" >}}

Grafana provides a variety of pre-built dashboard templates that you can use to quickly set up visualizations for your data. These dashboards use sample data, which you can replace with your own data, making it easier to get started with monitoring and analysis.

The templates provide standardized dashboard layouts designed to help you answer engineering or business questions consistently. For instance, the DORA template allows all teams within an organization to measure delivery performance using a widely adopted industry framework.

{{< figure src="/media/docs/grafana/dashboards/screenshot-dashboard-templates-2-v13.0.png" max-width="750px" alt="Selection of dashboard templates" >}}

### Create dashboards from templates

To create a dashboard from a template, follow these steps:

1. Click **Dashboards** in the primary menu.
1. Click **New** and select **Dashboard from template** in the drop-down menu.
1. Hover the cursor over the template you want to use and click **View template**.

   The dashboard created includes a banner panel indicating the dashboard is using sample data:

   {{< figure src="/media/docs/grafana/dashboards/screenshot-sample-data-dashboard-v13.0.png" max-width="750px" alt="Dashboard with sample data" >}}

1. Click **Save** in the top-right corner.
1. (Optional) Enter a new title for the dashboard.
1. (Optional) Select a folder for the dashboard.
1. Click **Save**.
1. Update the data source for each panel to add your own data and configure the queries you need.

   In Grafana Cloud, you also have the option to [customize the template using Grafana Assistant](#customize-templates-and-suggested-dashboards-with-grafana-assistant).

1. Make any other edits to the dashboard to most effectively display your data.
1. When you've made all of your changes, hover the cursor over the top-right corner of the banner panel to open the panel edit menu, and then click **Remove** to remove the panel.

   {{< figure src="/media/docs/grafana/dashboards/screenshot-remove-banner-v13.0.png" max-width="750px" alt="Removing the sample data banner panel" >}}

1. Click **Save**.
1. Enter an optional description of your updates, and click **Save**.

## Suggested dashboards

{{< docs/public-preview product="Suggested dashboards" >}}

Suggested dashboards can be helpful when you have a data source configured, but you're not sure how to most effectively visualize your data.
The process of creating a dashboard from a suggestion starts from the **Data sources** feature, so the suggestions are specific to your data source type (for example, Prometheus, Loki, or Elasticsearch).

The dashboards suggested are either provided by the data source plugin (provisioned) or come from the Grafana Community, and they are labeled to indicate this:

{{< figure src="/media/docs/grafana/dashboards/screenshot-suggested-dashboards-v13.0.png" max-width="750px" alt="Suggested dashboards dialog box" >}}

For Prometheus data sources, Grafana compares the metrics of your data source against those of the suggested dashboard to assess how much you might need to update the dashboard to make it useful. Using that analysis, Grafana assigns the dashboard a compatibility score:

{{< figure src="/media/docs/grafana/dashboards/screenshot-compatibility-scores-v13.0.png" max-width="750px" alt="Suggested dashboards dialog box" >}}

Access the suggested dashboards for a data source by clicking the **Build a dashboard** drop-down list and selecting **From suggestions**:

{{< figure src="/media/docs/grafana/dashboards/screenshot-build-dashboard-dropdown-v13.0.png" max-width="750px" alt="Build a dashboard drop-down list with From suggestions selected" >}}

The **From suggestions** option is only enabled if suggested dashboards are available for the data source.
If there are no suggestions available, Grafana displays a warning, and you won't be able to select the option.

### Create dashboards from suggestions

To build a dashboard from suggestions, follow these steps:

1. Navigate to **Connections > Data sources**.
1. Go to the row of the data source for which you want to create a dashboard.
1. Click the **Build a dashboard** drop-down list and select **From suggestions**.

   A dialog box with suggested dashboards opens.

1. Hover the cursor over the suggestion you want to use and click **View dashboard**.

   In Grafana Cloud, you also have the option to [customize the suggested dashboard using Grafana Assistant](#customize-templates-and-suggested-dashboards-with-grafana-assistant).

1. (Optional) Do one or more of the following:
   - If there are more than six suggested dashboards, use the page numbers or arrow buttons at the bottom of the dialog box to navigate between pages of suggestions.
   - To find a specific dashboard, enter the name of the dashboard in the search bar.
   - If, after viewing the suggested dashboard, you find it doesn't meet your needs, go back and choose a different suggestion or start a new dashboard by clicking one of the options in the banner:

   {{< figure src="/media/docs/grafana/dashboards/screenshot-suggested-dashboards-banner-v13.0.png" alt="Suggested dashboards banner" >}}

1. Complete the rest of the dashboard configuration.
1. Click **Save**.
1. (Optional) Enter a new title for the dashboard.
1. (Optional) Select a folder for the dashboard.
1. Click **Save**.

## Customize templates and suggested dashboards with Grafana Assistant

In Grafana Cloud, you can customize a dashboard template or suggested dashboard using Grafana Assistant.

To use this option, hover the cursor over the template or suggestion that you want to use and click **Customize with Assistant**:

{{< figure src="/media/docs/grafana/dashboards/screenshot-customize-w-asst-buttons-v13.0.png" alt="Grafana Assistant helping create a dashboard from template or suggestion" >}}

When you choose this option, a preconfigured prompt is entered into the Assistant chat to start the process:

{{< figure src="/media/docs/grafana/dashboards/screenshot-dash-template-w-asst-v13.0.png" max-width="750px" alt="Grafana Assistant helping create a dashboard from a template" caption="A dashboard template being customized by Grafana Assistant" >}}

{{< figure src="/media/docs/grafana/dashboards/screenshot-suggested-dash-w-asst-v13.0.png" max-width="750px" alt="Grafana Assistant helping create a dashboard from a suggestion" caption="A suggested dashboard being customized by Grafana Assistant" >}}

Grafana Assistant analyses the template or suggested dashboard, checks your available data sources, and guides the creation of a dashboard tailored to your environment.
This lets you create a working, relevant dashboard from a template or suggestion without the need to manually map metrics and panels.

Grafana Assistant can query a subset of data sources, so customizing with Assistant for other data sources might generate poor results.
For an up-to-date list of supported data sources, refer to the [Assistant documentation](https://grafana.com/docs/grafana-cloud/machine-learning/assistant/guides/querying/).
