---
description: Feature and improvement highlights for Grafana v11.0-preview
keywords:
  - grafana
  - new
  - documentation
  - '11.0'
  - '11.0-preview'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v11.0-preview
weight: -42
---

# What’s new in Grafana v11.0-preview

Welcome to Grafana 11.0-preview! This preview release contains some notable improvements...

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v11.0-preview, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.0/).

## Breaking changes

For Grafana v11.0-preview, we've also provided a list of [breaking changes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/breaking-changes/breaking-changes-v11-0) to help you upgrade with greater confidence. For information about these along with guidance on how to proceed, refer to [Breaking changes in Grafana v10.3](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/breaking-changes/breaking-changes-v11-0/).

<!-- Template below

## Feature
<!-- Name of contributor -->
<!--_[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise, all editions of Grafana, some combination of self-managed and Cloud]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
Use full URLs for links. When linking to versioned docs, replace the version with the version interpolation placeholder (for example, <GRAFANA_VERSION>, <TEMPO_VERSION>, <MIMIR_VERSION>) so the system can determine the correct set of docs to point to. For example, "https://grafana.com/docs/grafana/latest/administration/" becomes "https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/".
{{% /admonition %}}

<!--Add an image, GIF or video  as below-->

<!--{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="DESCRIPTIVE CAPTION" >}}

<!--Learn how to upload images here: https://grafana.com/docs/writers-toolkit/write/image-guidelines/#where-to-store-media-assets-->
<!---->

## Dashboards and visualizations

### Scenes for viewers

<!-- #grafana-dashboards, Dominik Prokop, Natalia Bernarte -->

_Generally available in all editions of Grafana_

Dashboards, when accessed by users with the Viewer role, are now using the Scenes library. Those users shouldn't see any difference in the dashboards apart from two small changes to the user interface (UI): the variables UI has slightly changed and the time picker is now part of the dashboard container.

Dashboards aren't affected for users in other roles.

This is the first step towards a more robust and dynamic dashboarding system that we'll be releasing in the upcoming months.

### Subfolders

<!-- #wg-nested-folders -->

_Generally available in all editions of Grafana_

Subfolders are here at last!

Some of you want subfolders in order to keep things tidier. It’s easy for dashboard sprawl to get out of control, and setting up folders in a nested hierarchy helps with that.

Others of you want subfolders in order to create nested layers of permissions, where teams have access at different levels that reflect their organization’s hierarchy.

We are thrilled to bring this long-awaited functionality to our community of users! Subfolders are currently being rolled out to Grafana Cloud instances and will be generally available to all Grafana users for the Grafana 11 release.

**Just a quick note**: the upgrade to enable subfolders can cause some issues with alerts in certain cases. We think these cases are pretty rare, but just in case, you’ll want to check for this:

If you've previously set up a folder that uses a forward slash in its name, and you have an alert rule in that folder, and the notification policy is set to match that folder's name, notifications will be sent to the default receiver instead of the configured receiver.

To correct this, take the following steps:

- Create a copy of the affected routes
- Rewrite the matchers for the new copy. For example, if the original matcher was `grafanafolder=folder_with/in_title`, then the new route matcher will be `grafana_folder=folder_with/_in_title`
- After rewriting the matchers, you can delete the old routes.

If you use file provisioning, you can upgrade and update the routes at the same time.

### Use AI to generate titles and descriptions for panels and dashboards

<!-- Ivan Ortega -->

_Generally available in all editions of Grafana_

You can now use generative AI to assist you in your Grafana dashboards. So far generative AI can help you generate **panel and dashboard titles and descriptions** - You can now generate a title and description for your panel or dashboard based on the data you've added to it. This is useful when you want to quickly visualize your data and don't want to spend time coming up with a title or description.

Make sure to enable and configure Grafana's LLM app plugin. For more information, refer to the [Grafana LLM app plugin documentation](https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin/).

When enabled, look for the **✨ Auto generate** option next to the **Title** and **Description** fields in your panels and dashboards, or when you press the **Save** button.

![Auto-generate a panel description using AI](/media/docs/grafana/dashboards/auto-generate-description-10-2.gif)

[Documentation](https://grafana.com/docs/grafana-cloud/alerting-and-irm/machine-learning/llm-plugin/)

### Substring matcher added to the filter by value transformation

<!-- #grafana-dataviz -->

_Generally available in Grafana Open Source and Grafana Cloud_

This update to the **Filter data by values** transformation simplifies data filtering by enabling partial string matching on field values thanks to two new matchers: **Contains substring** and **Does not contain substring**. With the substring matcher built into the **Filter data by values** transformation, you can efficiently filter large datasets, displaying relevant information with speed and precision. Whether you're searching for keywords, product names, or user IDs, this feature streamlines the process, saving time and effort while ensuring accurate data output.

In the **Filter data by values** transformation, simply add a condition, choose a field, choose your matcher, and then input the string to match against.

This update will be rolled out to customers over the next few weeks.

{{< video-embed src="/media/docs/grafana/substring-matcher.mp4" >}}

### Improvements to the canvas visualization

<!-- #dataviz-squad -->

_Generally available in all editions of Grafana_

We've made a number of improvements to the canvas visualization.

#### Enhanced flowcharting functionality

With this release, we've updated the canvas visualization to include much-requested flowcharting features. These improvements are:

- Addition of widely-used elements: cloud, parallelogram, and triangle.
- Addition of midpoint controls so that the connectors no longer have to be straight lines.
- Addition of more connector styles including dashed lines as well as corner radius and direction control.
- Horizontal and vertical snapping for connectors.
- Addition of rounded corner styling for elements.
- Ability to rotate elements in the canvas.

#### Universal data link support

We've updated data links so that you can add them to almost all elements or element properties that are tied to data. Previously, you could only add data links to text elements or elements that used the `TextConfig` object. This update removes that limitation.

{{< admonition type="note" >}}
This update doesn't apply to the drone and button elements.
{{< /admonition >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/)

### Infinite panning for the canvas visualization

<!-- Nathan Marrs, #grafana-dataviz -->

_Available in public preview in all editions of Grafana_

With the newly added **Infinite panning** editor option, you can now view and navigate very large canvases. This option is displayed when the **Pan and zoom** switch is enabled.

To try out this feature, you must first enable the `canvasPanelPanZoom` feature toggle.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/)

### Set threshold colors in the Config from query transformation

<!--  #grafana-dataviz" -->

_Generally available in all editions of Grafana_

You now have the ability to customize specific colors for individual thresholds when using the **Config from query results** transformer. Previously, when you added multiple thresholds, they all defaulted to the same color, red. With this addition, you gain the flexibility to assign distinct colors to each threshold.

This feature addresses a common pain point highlighted by users. With customizable threshold colors, you now have greater control over your data representation, fostering more insightful and impactful analyses across diverse datasets.

This feature will be rolled out over the next few weeks.

## Alerting

### Keep Last State for Grafana Managed Alerting

<!-- "#alerting" -->

_Generally available in all editions of Grafana_

(Re-)introducing "Keep Last State" to Grafana managed alert rules.

You can now choose to keep the last evaluated state of an alert rule when that rule produces "No Data" or "Error" results. Simply choose the "Keep Last State" option for no data or error handling when editing a rule. Refer to the Alerting documentation on state and health of alert rules for more information.[](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/state-and-health/#state-and-health-of-alert-rules)

### Alert detail view redesign

<!-- Gilles de Mey -->

_Generally available in all editions of Grafana_

The new alert rule detail view has a new look and feel with helpful metadata at the top. The namespace and group are shown in the breadcrumb navigation. This is interactive and can be used to filter rules by namespace or group. The rest of the alert detail content is split up into tabs:

**Query and conditions**

View the details of the query that is used for the alert rule, including the expressions and intermediate values for each step of the expression pipeline. A graph view is included for range queries and data sources that return time series-like data frames.

**Instances**

Explore each alert instance, its status, labels and various other metadata for multi-dimensional alert rules.

**History**

Explore the recorded history for an alert rule.

**Details**

Debug or audit using the alert rule metadata and view the alert rule annotations.

![Image shows details of an alert rule](/media/docs/alerting/alert-detail-view.png)

## Data sources

### Azure Monitor: Current User authentication

<!-- #grafana-partner-datasources, @Andreas -->

_Experimental in all editions of Grafana_

You can now configure the Azure Monitor data source to authenticate as the logged-in Grafana user when making query and resource requests if you also use Azure Entra to sign your users into Grafana.

Current User authentication allows you to enforce Azure RBAC restrictions on your Grafana users by removing the need to provide broad service credentials. Once a data source is configured with Current User authentication a user will **only** have access to resources they can access directly in Azure.

Additionally, data sources configured to use Current User authentication are less likely to be impacted by throttling issues due to the individual level of access.

Current User authentication does not inherently support backend features such as alerting. To account for this, data sources configured with Current User authentication can optionally specify service credentials that will be utilized for backend features when no signed-in user is available.

To get started with Current User authentication, refer to the [Azure Monitor data source documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/#configure-current-user-authentication).

{{< figure src="/media/docs/grafana/data-sources/screenshot-current-user.png" alt="Data source configured with Current User authentication" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/#configure-current-user-authentication)

### Removal of old Tempo Search and Loki Search in Tempo

<!-- Joey Tawadrous -->

_Generally available in all editions of Grafana_

#### Removal of old Tempo Search tab

In Grafana v10.1, we added a Tempo search editor powered by TraceQL (search tab). We also recommended using this new editor over the older non-TraceQL powered editor.

The older non-TraceQL powered editor has been removed. Any existing queries using the older editor will be automatically migrated to the new TraceQL-powered editor.

The new TraceQL-powered editor makes it much easier to build your query by way of static filters, better input/selection validation, copy query to the TraceQL tab, query preview, dedicated status filter, and the ability to run aggregate by (metrics summary) queries.

Refer to [Query tracing data](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/) to learn more.

#### Removal of Loki Search tab in Tempo

The Loki Search tab has been around since before we could natively query Tempo for traces.
This search is used by a low number of users in comparison to the TraceQL-powered editor (Search tab) or the TraceQL tab itself.

If you would like to see what logs are linked to a specific trace or service, you can use the [Trace to logs feature](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/configure-tempo-data-source/#trace-to-logs), which provides an easy way to create a custom link and set an appropriate time range if necessary.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/)
