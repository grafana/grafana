---
aliases:
  - ../data-sources/testdata/
  - ../features/datasources/testdata/
keywords:
  - grafana
  - dashboard
  - documentation
  - troubleshooting
  - panels
  - testdata
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: TestData
title: TestData data source
weight: 1500
refs:
  panels-visualizations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
---

# TestData data source

Grafana ships with a TestData data source, which creates simulated time series data for any [panel](ref:panels-visualizations).
You can use it to build your own fake and random time series data and render it in any panel, which helps you verify dashboard functionality since you can safely and easily share the data.

For instructions on how to add a data source to Grafana, refer to the [administration documentation](ref:data-source-management).
Only users with the organization administrator role can add data sources.

## Configure the data source

To configure basic settings for the data source, complete the following steps:

1.  Click **Connections** in the left-side menu.
1.  Under Your connections, click **Data sources**.
1.  Enter `TestData` in the search bar.
1.  Select **TestData**.

    The **Settings** tab of the data source is displayed. The data source doesn't provide any settings beyond the most basic options common to all data sources:

    | Name        | Description                                                              |
    | ----------- | ------------------------------------------------------------------------ |
    | **Name**    | Sets the name you use to refer to the data source in panels and queries. |
    | **Default** | Defines whether this data source is pre-selected for new panels.         |

## Create mock data

{{< figure src="/media/docs/grafana/data-sources/screenshot-testdata-add-10.0.png" class="docs-image--no-shadow" caption="Adding test data" >}}

Once you've added the TestData data source, your Grafana instance's users can use it as a data source in any metric panel.

### Choose a scenario

Instead of providing a query editor, the TestData data source helps you select a **Scenario** that generates simulated data for panels.

You can assign an **Alias** to each scenario, and many have their own options that appear when selected.

{{< figure src="/media/docs/grafana/data-sources/screenshot-testdata-csv-example-10.0.png" class="docs-image--no-shadow" caption="Using CSV Metric Values" >}}

**Available scenarios:**

- **Annotations**
- **Conditional Error**
- **CSV Content**
- **CSV File**
- **CSV Metric Values**
- **Datapoints Outside Range**
- **Exponential heatmap bucket data**
- **Flame Graph**
- **Grafana API**
- **Grafana Live**
- **Linear heatmap bucket data**
- **Load Apache Arrow Data**
- **Logs**
- **No Data Points**
- **Node Graph**
- **Predictable CSV Wave**
- **Predictable Pulse**
- **Random Walk**
- **Random Walk (with error)**
- **Random Walk Table**
- **Raw Frames**
- **Simulation**
- **Slow Query**
- **Streaming Client**
- **Table Static**
- **Trace**
- **USA generated data**

## Import a pre-configured dashboard

TestData also provides an example dashboard.

**To import the example dashboard:**

1. Navigate to the data source's [configuration page](#configure-the-data-source).
1. Select the **Dashboards** tab.
1. Select **Import** for the **Simple Streaming Example** dashboard.

**To customize an imported dashboard:**

To customize the imported dashboard, we recommend that you save it under a different name.
If you don't, upgrading Grafana can overwrite the customized dashboard with the new version.

## Use test data to report issues

If you report an issue on GitHub involving the use or rendering of time series data, we strongly recommend that you use this data source to replicate the issue.
That makes it much easier for the developers to replicate and solve your issue.

## Use a custom version of TestData

{{< admonition type="note" >}}
This feature is experimental and requires Grafana version 10.3.0 or later.
{{< /admonition >}}

If you want to use a version of TestData different from the one shipped with Grafana, follow these steps:

1. Set the configuration field `as_external` for the plugin to `true`. An example configuration would be:

   ```ini
   [plugin.grafana-testdata-datasource]
   as_external = true
   ```

1. Restart Grafana.

These settings, if enabled, allow you to to install TestData as an external plugin and manage its lifecycle independently of Grafana.

With the feature toggle disabled (default) TestData can still be installed as an external plugin, but it has no effect as the bundled, Core version of TestData is already installed and takes precedence.
