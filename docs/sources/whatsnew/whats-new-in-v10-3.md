---
description: Feature and improvement highlights for Grafana v10.3
keywords:
  - grafana
  - new
  - documentation
  - '10.3'
  - '10.2.3'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v10.3
weight: -40
---

# What’s new in Grafana v10.3

Welcome to Grafana 10.3! Read on to learn about changes to navigation, visualizations and transformations, alerting, profiling, and logs.

We've also included here features released in Grafana 10.2.3, as well as breaking changes from that release. Features that were included in the 10.2.3 release are marked with an asterisk.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.3, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v10.3/).

## Breaking changes

For Grafana v10.3, we've also provided a list of [breaking changes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/breaking-changes/breaking-changes-v10-3) to help you upgrade with greater confidence. For information about these along with guidance on how to proceed, refer to [Breaking changes in Grafana v10.3](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/breaking-changes/breaking-changes-v10-3/).

<!-- Template below

## Feature
<!-- Name of contributor -->
<!--_[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise, all editions of Grafana, some combination of self-managed and Cloud]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{< admonition type="note" >}}
Use full URLs for links. When linking to versioned docs, replace the version with the version interpolation placeholder (for example, <GRAFANA_VERSION>, <TEMPO_VERSION>, <MIMIR_VERSION>) so the system can determine the correct set of docs to point to. For example, "https://grafana.com/docs/grafana/latest/administration/" becomes "https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/".
{{< /admonition >}}

<!--Add an image, GIF or video  as below-->

<!--{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="DESCRIPTIVE CAPTION" >}}

<!--Learn how to upload images here: https://grafana.com/docs/writers-toolkit/write/image-guidelines/#where-to-store-media-assets-->
<!---->

## Navigation updates\*

<!--Laura Benz-->

_Available in public preview in Grafana Open Source and Enterprise_

The improved navigation menu gives you a better overview by showing all levels of navigation items in a more compact design. We also implemented a better dock and improved scrolling behavior. Furthermore, we improved the structure of the nav menu and added several new items.

{{< youtube id="IhpghtVykLc" >}}

## Table data in PDF reports

<!--Agnès Toulet-->

_Available in public preview in Grafana Enterprise and Grafana Cloud_

We've improved the reporting experience with options to make all of your table data accessible in PDFs. Previously, if your dashboard included large table visualizations, you couldn't see all of the table data in your PDF report. Unlike in Grafana, you couldn't scroll in the PDF table visualization or click on the page numbers. With this new feature, you now have the option to see all the data directly in your PDF without losing your dashboard layout.

We've added two format options to the report creation form:

- **Include table data as PDF appendix** - Adds an appendix to your dashboard PDF.
- **Attach a separate PDF of table data** - Generates a separate PDF file for your table panel data.

To try out this feature, enable the `pdfTables` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/) or contact Grafana Support to have it enabled in on your Grafana Cloud stack.

{{< youtube id="1fzQQI8O838" >}}

## Dashboards and visualizations

### Moving average and trend lines using transformations

<!--Oscar Kilhed-->

_Available in public preview in all editions of Grafana_

#### Moving average\*

Sometimes your data is too noisy to quickly grasp what's going on. A common way to address this issue is to calculate the moving mean, or moving average, to filter out some of that noise. Luckily, many data sources already support calculating the moving mean, but when the support is lacking or you're not well versed in the query language, until now, you were stuck with the noise.

{{< figure src="/media/docs/grafana/transformations/noisy-sensor-data.png" caption="Noisy data can hide the general trend of your data." alt="Graph displaying noisy sensor data" max-width="300px" >}}

By selecting the **Window functions** mode and using **Mean** as the calculation for the **Add field from calculation** transformation, Grafana adds a field with the moving mean for your selected field.

{{< figure src="/media/docs/grafana/transformations/noisy-sensor-data-moving-average.png" caption="Calculating the moving mean of your data will make it easier to grasp what's going on." alt="Graph displaying the moving mean of noisy data" >}}

The **Window functions** mode also supports moving variance and moving standard deviation calculations if you need to analyze the volatility of your metric.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation)

#### Trend lines\*

We're also adding some basic statistical analysis features as a way to help you visualize trends in your data. The **Regression analysis** transformation will fit a mathematical function to your data and display it as predicted data points in a separate data frame.

{{< figure src="/media/docs/grafana/transformations/trendlines.png" caption="Linear and polynomial regression trendlines" alt="Graph with trendlines" >}}

The transformation currently supports linear regression and polynomial regression to the fifth-degree.

### Canvas visualization supports pan and zoom

<!--Nathan Marrs-->

_Available in public preview in all editions of Grafana_

Canvas visualizations now support panning and zooming. This allows you to both create and navigate more complex designs.

To enable this feature, you must first enable the `canvasPanelPanZoom` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

{{< youtube id="CF-HFkcytRA" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/)

### Improved tooltips in visualizations\*

<!--Nathan Marrs-->

_Available in public preview in all editions of Grafana_

We've introduced enhanced tooltips as part of our standardization initiative, unifying the tooltip architecture for a consistent user experience across panels. Packed with features like color indicators, time uniformity, and improved support for long labels, these tooltips go beyond a cosmetic redesign, bringing fundamental changes to elevate your data visualization experience. Stay tuned for more updates!

To try out the new tooltips, enable the `newVizTooltips` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/). Enhanced tooltips have been implemented for the following visualizations:

- Time series
- Trend
- Heatmap
- Status history
- Candlestick
- State timeline
- XY Chart
- and more coming soon!

{{< admonition type="note" >}}
As this is an ongoing project, the dashboard shared cursor and annotations features are not yet fully supported.
{{< /admonition >}}

{{< youtube id="0Rp6FYfHu6Q" >}}

### Plot enum values in your time series and state timeline visualizations\*

<!--Nathan Marrs-->

_Generally available in all editions of Grafana_

You can now plot enum values in your time series and state timeline visualizations. This feature is useful when you want to visualize the state of a system, such as the status of a service or the health of a device. For example, you can use this feature to visualize the status of a service as `ON`, `STANDBY`, or `OFF`. To display enum values you can [use the convert field transform](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#convert-field-type).

{{< youtube id="FG0hBFfgpps" >}}

### View percent change in stat visualizations

<!--Nathan Marrs-->

_Generally available in all editions of Grafana_

You can now view percent change in stat visualizations. This makes it easier to understand your data by showing how metrics are changing over time.

{{< youtube id="mB9FU0myZo8" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/stat/#show-percent-change)

#### Apply data transformations to annotations

<!--Nathan Marrs-->

_Generally available in all editions of Grafana_

You can now apply data transformations to annotation data. For example, you can now configure how exemplar data is displayed in tooltips.

{{< video-embed src="/media/docs/grafana/screen-recording-10-3-data-transformations-annotation-support.mp4" caption="Configure how exemplar data appears in tooltip" >}}

### New Transformations UI experience and documentation upgrades

<!--Jev Forsberg-->

_Generally available in all editions of Grafana_

We've revamped the Transformations user interface to make it cleaner, more user-friendly, and overall better for visualizing, selecting, and comprehending transformation options for your data.

#### Improved UI\*

In the past, transformations were applied through a dropdown menu, indicated solely by text names like Merge, Sort, JoinByLabels, etc. Now, we've introduced a much more user-friendly interface. A convenient drawer allows seamless access to all transformation options, each accompanied by visual/graphical representations and a brief description. These enhancements are designed to enhance the user's comprehension of their data transformation choices.

{{< figure src="/media/docs/grafana/transformations/transformations_ui_drawer_selector.png" caption="The new Transformation UI drawer" alt="Transformation UI drawer" >}}

#### In-App documentation

We've also streamlined the user experience by integrating documentation directly into the core Grafana application. Gone are the days of navigating to a separate browser page for Transformation documentation. Now, users can conveniently access documentation within the app interface, providing a more seamless and efficient way to understand and utilize various features. This enhancement aims to save time and enhance user convenience, ensuring that valuable information is readily available at their fingertips.

{{< figure src="/media/docs/grafana/transformations/transformations_internal_documentation.png" caption="Transformation documentation is now internally available inside the Grafana app itself." alt="Transformation documentation internally available" >}}

### Copy and paste time range

<!--Haris Rozajac-->

_Generally available in all editions of Grafana_

Copying and pasting time range in the time range picker is now available. For example, you can copy a time range in **Explore** and paste it into **Dashboards** and vice versa. You can also copy and paste a time range using the new keyboard shortcuts `t+c` and `t+v`, respectively.

## Profiles

### Trace to Profiles\*

<!--Joey Tawadrous-->

_Experimental in all editions of Grafana_

Using Trace to profiles, you can use Grafana’s ability to correlate different signals by adding the functionality to link between traces and profiles.

**Trace to profiles** lets you link your Grafana Pyroscope data source to tracing data. When configured, this connection lets you run queries from a trace span into the profile data.

There are two ways to configure the trace to profiles feature:

- Use a simplified configuration with default query, or
- Configure a custom query where you can use a template language to interpolate variables from the trace or span.

{{< figure src="/static/img/docs/tempo/profiles/tempo-trace-to-profile.png" caption="Trace to profiles screenshot" alt="Trace to profiles screenshot" >}}

To try out **Trace to profiles**, enable the 'traceToProfiles' feature toggle.

If you would also like to try out the **Embedded Flame Graph** feature, please enable the 'tracesEmbeddedFlameGraph' feature toggle.

Note: in order to determine that there is a profile for a given span and render the 'Profiles for this span' button or the embedded flame graph in the span details, the 'pyroscope.profile.id' key-value pair must exist in your span tags.

{{< youtube id="AG8VzfFMLxo" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#trace-to-profiles)

### FlameGraph: Collapsing similar items in the graph\*

<!--Andrej Ocenas-->

_Experimental in all editions of Grafana_

Sometimes profile stacks contain lots of levels with similar repeating items, for example long stacks of framework code that usually isn't of interest but takes up a lot of visual real estate. With this feature, instead of rendering all of the similar items we render only one and allow to expand those collapsed items on demand.

To try it out, enable the ‘traceToProfiles’ feature toggle. To enable it in your Grafana Cloud stack, contact Grafana Support.

{{< youtube id="Y1c32Cf5nSE" >}}

## Alerting

### Alerting insights\*

<!-- George Robinson -->

_Generally available in all editions of Grafana_

Use Alerting insights to monitor your alerting data, discover key trends about your organization’s alert management performance, and find patterns in why things go wrong.

### Export alerting resources to Terraform

<!-- Yuri Tseretyan-->

_Generally available in all editions of Grafana_

Export your alerting resources, such as alert rules, contact points, and notification policies as Terraform resources. A new “Modify export” mode for alert rules enables you to edit provisioned alert rules and export a modified version.

### Contact points list view redesign

<!-- Brenda Muir -->

_Generally available in all editions of Grafana_

The Contact points list view has been redesigned and split into two tabs: Contact Points and Notification Templates, making it easier to view all contact point information at a glance. You can now search for name and type of contact points and integrations, view how many notification policies each contact point is being used for, and navigate directly to the linked notification policies.

{{< youtube id="_eOhSmbYK8Q" >}}

### Create alerts from panels\*

<!-- Brenda Muir -->

_Generally available in all editions of Grafana_

Create alerts from dashboard panels. You can reuse the panel queries and create alerts based on them.

### Support for adding responders to Opsgenie alerting contact point\*

<!--Ryan Kehoe-->

_Generally available in all editions of Grafana_

The Opsgenie contact point has been extended to allow users to optionally fill out responder information for their integration. Responders tell Opsgenie who an alert should notify according to their escalation policies and routing rules.

### Recovery thresholds for alerts

<!--Ryan Kehoe-->

_Generally available in all editions of Grafana_

To reduce the noise of flapping alerts, you can set a recovery threshold different to the alert threshold.

Flapping alerts occur when a metric hovers around the alert threshold condition and may lead to frequent state changes, resulting in too many notifications being generated.

## Logs

### Logs Table UI

<!--Galen Kistler-->

_Available in public preview in all editions of Grafana_

Table view was created to help facilitate ease of use in a point and click UI, as opposed to datasource specific query language formatting options, like loki's line_format.

Tables can be configured and shared with team members via explore URLs or by adding the table to a dashboard panel.

{{< youtube id="OAZeqqNpEjc" >}}

## Data sources

### Data source Admin permission\*

<!--Ieva Vasiljeva-->

_Generally available in Grafana Enterprise and Grafana Cloud_

In addition to `Query` and `Edit` access, you can now grant users, teams, or basic roles `Admin` access to data sources. Users with `Admin` access to a data source can grant and revoke permissions to the data source, as well as to manage query caching settings for the data source. Users are automatically granted `Admin` access to data sources that they create.

### Redshift and Athena: Async query caching

<!--Isabella Siu-->

_Generally available in Grafana Enterprise, Grafana Cloud Advanced and Cloud Pro_

Introducing query caching for async queries in the Athena and Redshift data source plugins. We previously introduced async queries for the Athena and Redshift plugins, and this feature adds support for caching those queries. To use this, you must have query caching enabled for the Athena or Redshift data source you wish to cache. This feature was previously available behind a feature toggle and is now generally available and enabled by default.

{{< admonition type="note" >}}

The `useCachingService` feature toggle must also be enabled to use this feature.

{{< /admonition >}}

### Loki data source improvements: "or" filter syntax, filter by label types, derived fields by labels

<!--Sven Grossmann-->
<!--enablement videos to come?-->

_Generally available in all editions of Grafana_

Introducing several improvements to the Loki data source.

{{< youtube id="ievPSzmCrAk" >}}

#### Line filter "or" syntax\*

Loki's line filter syntax is great to find specific substrings of your log lines. If users want to find multiple different substrings it was cumbersome to use the regex `=~` operator. With this change it is possible to chain multiple strings with the existing filter operators.

Example:

```
{app="foo"} |= "foo" or "bar" != "baz" or "qux"
```

#### Filter based on label type\*

Grafana users can use the action buttons in the log details to filter for specific labels. Those would be always added as a LabelFilter expression regardless of the type of the label. Now, filtered labels will be added either to the stream selector if the label is an indexed label, or as a LabelFilter expression if the label is a parsed label or part of structured metadata.

#### Derived fields based on labels\*

Derived fields or data links are a concept to add correlations based on your log lines. Previously it was only possible to add derived fields based on a regular expression of your log line and doing it based on labels was not possible. With this change derived fields can be added either based on a regex of a log line or based on a label, parsed label or structured metadata.

The following example would add the derived field `traceID regex` based on a regular expression and another `app label` field based on the `app` label.

{{< figure src="/media/docs/grafana/2024-01-05_loki-derived-fields.png" alt="Derived fields added based on a regular expression and an app label">}}

### InfluxDB native SQL support

<!--Ismail Simsek-->

_Generally available in all editions of Grafana_

InfluxDB introduced [a new version, 3.0](https://www.influxdata.com/blog/introducing-influxdb-3-0/), in April. With this new version, InfluxDB has put [Flux in maintenance mode](https://www.influxdata.com/blog/the-plan-for-influxdb-3-0-open-source/#heading4). But with the new version we have a new querying language, [Native SQL](https://www.influxdata.com/products/sql/). With v10.3.0, Grafana has built-in support for SQL query language in InfluxDB.

All you need to do is set up your InfluxDB Cloud Account and create your InfluxDB data source on Grafana with the query language "SQL" selected.

{{< youtube id="jGclGsv5PBA" >}}

## Authentication and authorization

### Grafana Anonymous Access\*

<!--Eric Leijonmarck-->

_Generally available in Grafana Open Source and Enterprise_

We've identified a need for users who enable anonymous authentication to monitor the anonymous devices connected to their Grafana instance. This feature is part of our ongoing efforts to enhance control and transparency regarding anonymous usage.

Anonymous access now allows users, including those in open-source and enterprise self-managed environments, to view and monitor their anonymous access. They can also set a device limit, configuring a specific number of anonymous devices to connect to their instance.

Once this limit is reached, any new devices attempting to connect will be denied access until existing devices disconnect.

The anonymous devices feature improves the management and monitoring of anonymous access within your Grafana instance.

**Anonymous Device:**

When anonymous access has been enabled, any device which accesses Grafana in the last 30 days (without logging in) is considered an active anonymous device. Users can now view anonymous devices on the users page, anonymous usage statistics, including the count of devices and users over this period.

**Grafana UI:**

- Navigate to Administration -> Users to access the anonymous devices tab.

- A new statistic has been added to the Usage & Stats page, displaying active anonymous devices from the last 30 days.

{{< youtube id="B72X3_9e-ds" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/grafana/)
