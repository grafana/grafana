---
aliases:
  - ../data-sources/testdata/
  - ../features/datasources/testdata/
description: Guide for using TestData in Grafana to generate simulated data for testing dashboards and panels.
keywords:
  - grafana
  - testdata
  - test data
  - mock data
  - simulated data
  - dashboard testing
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: TestData
title: TestData data source
weight: 1500
review_date: '2026-04-08'
---

# TestData data source

Grafana ships with a built-in TestData data source that generates simulated time-series, log, trace, and other data for any [panel](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/). You can use it to verify dashboard functionality, test visualizations, prototype alerting rules, and reproduce issues without connecting to an external data source.

## Supported features

| Feature     | Supported |
| ----------- | --------- |
| Metrics     | Yes       |
| Logs        | Yes       |
| Alerting    | Yes       |
| Annotations | Yes       |

## Get started

The following pages help you set up and use the TestData data source:

- [Configure the TestData data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/configure/) for setup and provisioning instructions.
- [TestData query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/query-editor/) for a reference of all 30 available scenarios and their options.
- [TestData alerting](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/alerting/) for prototyping and testing alert rules with simulated data.
- [TestData template variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/template-variables/) for using TestData with dashboard variables.
- [Troubleshoot TestData](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/troubleshooting/) for solutions to common issues.

## Additional features

After adding the data source, you can:

- Use [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/) to run scenarios without building a dashboard.
- Add [transformations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/) to manipulate query results.
- Build [dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/) with simulated data for prototyping and demos.

## Pre-built dashboard

TestData includes a bundled dashboard that demonstrates streaming data scenarios.

To import the dashboard:

1. Navigate to the data source's [configuration page](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/testdata/configure/).
1. Select the **Dashboards** tab.
1. Click **Import** for the **Streaming Example** dashboard.

To customize the imported dashboard, save it under a different name first. Otherwise, upgrading Grafana can overwrite your customizations.

## Report issues with test data

If you report an issue on GitHub involving time-series data rendering, use the TestData data source to replicate the problem. This makes it easier for developers to reproduce and resolve the issue.

## Use a custom version of TestData

If you want to use a version of TestData different from the one shipped with Grafana, you can configure Grafana to skip loading the bundled version. This lets you install TestData as an external plugin and manage its lifecycle independently.

To enable this:

1. Set the `as_external` configuration field for the plugin to `true`:

   ```ini
   [plugin.grafana-testdata-datasource]
   as_external = true
   ```

1. Restart Grafana.

With the default configuration, Grafana loads the bundled core version of TestData. An externally installed version has no effect unless `as_external` is set to `true`.

## Plugin updates

TestData is a core plugin that ships with Grafana. It updates automatically when you upgrade your Grafana instance.

If you use TestData as an [external plugin](#use-a-custom-version-of-testdata), navigate to **Administration** > **Plugins and data** > **Plugins** to check for updates.

{{< admonition type="note" >}}
Plugins are automatically updated in Grafana Cloud.
{{< /admonition >}}
