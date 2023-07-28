---
description: Feature and improvement highlights for Grafana v10.1
keywords:
  - grafana
  - new
  - documentation
  - '10.1'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v10.1
weight: -38
---

# What’s new in Grafana v10.1

Welcome to Grafana 10.1! Read on to learn about changes to search and navigation, dashboards and visualizations, and security and authentication. We're particularly excited about a set of improvements to visualizing logs from [Loki](https://grafana.com/products/cloud/logs/) and other logging data sources in Explore mode, and our flamegraph panel, used to visualize profiling data from [Pyroscope](https://grafana.com/blog/2023/03/15/pyroscope-grafana-phlare-join-for-oss-continuous-profiling/?pg=oss-phlare&plcmt=top-promo-banner) and other continuous profiling data sources.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.1, check out our [Upgrade Guide]({{< relref "../upgrade-guide/upgrade-v10.1/index.md" >}}).

<!-- Template below
## Feature
<!-- Name of contributor -->
<!-- _[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).
{{% /admonition %}}
-->
<!-- Add an image, GIF or video  as below

{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="DESCRIPTIVE CAPTION" >}}

Learn how to upload images here: https://grafana.com/docs/writers-toolkit/write/image-guidelines/#where-to-store-media-assets
-->

## Dashboards and visualizations

### Flamegraph improvements

_Generally available in all editions of Grafana._

<!-- Andrej Ocenas -->

We have added 4 new features to the flamegraph visualization:

- **Sandwich view**: You can now show a sandwich of any symbol in the flamegraph. Sandwich view will show all the callers on the top and all the callees of the symbol on the bottom. This is useful when you want to see the context of a symbol.
- **Switching color scheme**: You can now switch color scheme between color gradient by the relative value of a symbol or by package name of a symbol.
- **Switching symbol name alignment**: Symbols with long names may be problematic to differentiate if they have the same prefix. This new option allows you to align the text to left or right so that you can see the part of the symbol name that is important.
- **Improved navigation**: You can also highlight a symbol or switch on sandwich view for a symbol from the table. Also, a new status bar on top of the flamegraph gives you an overview of which views are enabled.

{{< video-embed src="/media/docs/grafana/panels-visualizations/screen-recording-grafana-10.1-flamegraph-whatsnew.mp4" >}}

### Distinguish Widgets from visualizations

<!-- Alexa Vargas, Juan Cabanas -->

_Experimental in all editions of Grafana._

This experimental feature introduces a clear distinction between two different categories of panel plugin types: visualization panels that consume a data source and a new type called _widgets_ that don't require a data source.

Now, you can easily add widgets like Text, News, and Annotation list without the need to select a data source. The plugins list and library panels are filtered based on whether you've selected a widget or visualization, providing a streamlined editing experience.

To see the widget editor in Grafana OSS or Enterprise, enable the `vizAndWidgetSplit` feature toggle. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support.

{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="New widget option added to empty dashboards" >}}

### Transformations facelift

The transformations tab has an improved user experience and visual redesign! Now you can explore transformations with categories and illustrations.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-transformations.png" max-width="750px" caption="Transformations redesign" >}}

### Format Time Transformation

<!-- Kyle Cunningham -->

_Available in public preview in all editions of Grafana._

When working with date and time data, it can be useful to have different time formats. With the new format time transformation, you can convert any time format to any other supported by Moment.js to be used in displaying times. When used in conjunction with the _Group by Value_ transformation, this can also be used to bucket days, weeks, and other time windows together.

{{< figure src="/media/docs/grafana/format-time-10-1.gif" max-width="750px" caption="Format time transformation" >}}

### Join by fields transformation outer join (tabular) option

<!-- Brendan O'Handley -->

The join by fields transformation has a new option. This option, outer join (tabular), is a true outer join for tabular data (SQL-like data). Data can now be joined on a field value that is not distinct. This is different from the previous outer join which is optimized for time series data where the join values are never repeated.

### Disconnect values in time series, trend, and state timeline visualizations

_Generally available in all editions of Grafana._

<!-- Nathan Marrs -->

You can now choose whether to set a threshold above which values in the data should be disconnected. This can be useful in cases where you have sensors that report a value at a set interval, but you want to disconnect the values when the sensor does not respond. This feature complements the existing [connect null values functionality]({{< relref "../panels-visualizations/visualizations/time-series/#connect-null-values" >}}).

To learn more, refer to our [disconnect values documentation]({{< relref "../panels-visualizations/visualizations/time-series/#disconnect-values" >}}).

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-disconnect-values-examples.png" max-width="750px" caption="Disconnect values in time series, trend, and state timeline visualizations" >}}

### Geomap network layer

_Available in public preview in all editions of Grafana._

<!-- Nathan Marrs -->

You can now display network data in the Geomap visualization by using the new beta Network layer. This layer supports the same data format as the [Node graph visualization]({{< relref "../panels-visualizations/visualizations/node-graph/#data-api" >}}).

To learn more, refer to our [Geomap network layer documentation]({{< relref "../panels-visualizations/visualizations/geomap/#network-layer-beta" >}}).

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-geomap-network-layer-v2.png" max-width="750px" caption="Geomap network layer" >}}

### Heatmap visualizations now support datalinks

_Generally available in all editions of Grafana._

<!-- Nathan Marrs -->

You can now add datalinks to heatmap visualizations. This allows you to add links to other dashboards, panels, or external URLs that are relevant to the data in your heatmap. This feature was a community contribution!

To learn more, refer to both our [heatmap documentation]({{< relref "../panels-visualizations/visualizations/heatmap/" >}}) and our [datalink documentation]({{< relref "../panels-visualizations/configure-data-links/" >}}).

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-heatmap-datalinks.png" max-width="750px" caption="Heatmap datalink support" >}}

## Data sources

### Step editor in Loki

<!-- Ivana Huckova -->

_Generally available in all editions of Grafana._

We've improved the Loki query editor by adding a new step editor. This editor allows you to specify a value for the _step_ parameter in Loki queries. You can use this parameter when making metric queries to Loki or when you want to get a matrix response from your queries.

By default, the step parameter is set to the value of the `$__interval` variable. This variable is calculated based on the time range and the width of the graph (in pixels). If you want to learn more about the Loki step parameter, you can visit [the Loki step parameter documentation](<(https://grafana.com/docs/loki/latest/api/#step-versus-interval)>).

{{< figure src="/media/docs/grafana/data-sources/loki-step-editor.png" max-width="750px" caption="New Loki step editor" >}}

### Copy link to a Loki log line

<!-- Sven Grossmann -->

_Generally available in all editions of Grafana._

A new linking of Loki log lines in Explore allows you to quickly navigate to specific log entries for precise analysis. By clicking the **Copy shortlink** button for a log line, you can generate and copy a [short URL]({{< relref "../developers/http_api/short_url/" >}}) that provides direct access to the exact log entry within an absolute time range. When you open the link, Grafana automatically scrolls to the corresponding log line and highlights it with a blue background, making it easy to identify and focus on the relevant information.

{{< figure src="/media/docs/grafana/data-sources/loki-shortlink.png" max-width="750px" caption="New Loki step editor" >}}

### TraceQL response streaming in Tempo

<!-- André Pereira -->

_Experimental in all editions of Grafana._

Grafana's Tempo data source now supports _streaming_ responses to TraceQL queries. With this feature, you can now see partial query results as they come in, so no more waiting for the whole query to finish. This is perfect for big queries that take a long time to return a response.

To use this feature, enable the `traceQLStreaming` feature toggle. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support.

Streaming is available for both the Search and TraceQL query types, and you'll get immediate visibility of incoming traces on the results table. This smooth integration makes data exploration a breeze and speeds up decision-making.

{{< video-embed src="/media/docs/grafana/data-sources/tempo-streaming-v2.mp4" >}}

### Tempo Search - powered by TraceQL

<!-- André Pereira -->

_Generally available in all editions of Grafana._

The Search query type was replaced with a new editor powered by TraceQL. This new editor allows you to use the same query language for both Search and TraceQL queries. This change also brings a new UI that makes it easier to write queries and explore your data while using the powerful features offered by TraceQL.

The previous Search interface is now deprecated and will be removed in a future release. We recommend that you start using the new editor as soon as possible and migrate existing dashboards.

{{< figure src="/media/docs/grafana/data-sources/tempo-search.png" max-width="750px" caption="Tempo Search editor powered by TraceQL" >}}

### Span filtering for traces is GA

_Generally available in all editions of Grafana._

<!-- Joey Tawadrous -->

Since the last release, we've made several improvements to span filtering. We're promoting span filters out of public preview and into general availability.

Span filters allow you to work much more efficiently with traces that consist of a large number of spans.

Span filters exist above the trace view and allow you to filter the spans that are shown in the trace view. The more filters you add, the more specific are the filtered spans.

Currently, you can add one or more of the following filters:

- Service name
- Span name
- Duration
- Tags (which include tags, process tags, and log fields)

To only show the spans you have matched, you can press the `Show matches only` toggle.

Learn more about span filtering in our [Tempo data source documentation]({{< relref "../datasources/tempo/#span-filters" >}}).

{{< figure src="/media/docs/tempo/screenshot-grafana-tempo-span-filters-v10-1.png" max-width="750px" caption="Traces span filtering" >}}

### Configuration page redesign for Loki and Elasticsearch

<!-- Matías Wenceslao Chomicki -->

_Generally available in all editions of Grafana._

Loki and Elasticsearch data source configuration pages have been redesigned to make getting started and setting up data sources as simple and easy to understand as possible. You can now find new subsections with links to configuration pages and tooltips to assist you with configuring and customizing data sources.

### Loki query splitting

<!-- Matías Wenceslao Chomicki -->

_Generally available in all editions of Grafana._

In response to different query performance scenarios, we implemented query splitting, where queries that request more than a day of data are split in sub-requests of 1 day duration each. For example, requesting 7 days of logs will produce 7 requests of 1 day.

### Easier to use query editor for Elasticsearch

<!-- Gabor Farkas -->

_Generally available in all editions of Grafana._

The Elasticsearch query editor now allows convenient switching between logs, metrics, and raw data directly from the top, eliminating the need to go through the metric selector.

### Metrics explorer

The Metrics Explorer is a new feature to enhance metric browsing in the Prometheus query builder. The Metrics Explorer makes it easier for you to find the right metric, and get comfortable with PromQL. You can now explore metrics with additional metadata, perform fuzzy search on the metric name / description, and filter on the Prometheus type.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-metrics-explorer.png" max-width="750px" caption="Metrics explorer" >}}

## Redshift And Athena: Async Query Data Support

<!-- Isabella Siu, Kevin Yu, Andrés Martínez -->

_Generally available in all editions of Grafana._

Async Query Data Support in Redshift and Athena makes queries over multiple requests (starting, checking its status, and fetching the results) instead of single request queries. This is useful for queries that can potentially run for a long time and timeout. This feature has been available behind a feature toggle for some time and is now be generally available and enabled by default.

## Redshift And Athena: Async Query Caching

<!-- Isabella Siu -->

_Experimental in Enterprise, Cloud Pro, and Cloud Advanced_

This adds support for query caching of async queries in the Athena and Redshift Data Source Plugins. To test this feature enable both the `useCachingService` and `awsAsyncQueryCaching` feature toggles. If you’re using Grafana Cloud and would like to enable this experimental feature, please contact customer support.

### CloudWatch Logs Monaco query editor

<!-- Isabella Siu, Kevin Yu -->

_Experimental in all editions of Grafana_

The CloudWatch Logs query editor is moving from being a Slate-based editor to a Monaco-based editor. This new Monaco-based editor will provide improved syntax highlighting, and auto-completion. Enable the `cloudWatchLogsMonacoEditor` feature toggle to use the Monaco-based query editor. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support.

### InfluxDB Backend Mode

<!-- Ismail Simsek -->

_Behind the feature toggle `influxdbBackendMigration`_

InfluxDB backend mode was available for a while but it had some compatibility issues. All those issues were addressed and there is no more compatibility issues. In the future backend mode will be the default one and we will deprecate frontend mode. Users won't need to do anything specific when we make it enabled by default. If you'd like to try backend mode right away you can enable `influxdbBackendMigration` feature toggle.

## Explore

### Logs: Choose which fields to display in a log line

<!-- Matías Wenceslao Chomicki -->

_Generally available in all editions of Grafana._

When you're browsing logs in Explore, you can click on the "eye" icon within a row to replace the log line's contents with the value of just one or more of the log fields or labels. This is helpful for scanning through your logs.

{{< figure src="/media/docs/grafana/log-field-picker-10-1.gif" max-width="750px" caption="Log rows menu" >}}

### Logs: Improved rendering performance of log lines

<!-- Matías Wenceslao Chomicki -->

_Generally available in all editions of Grafana._

Browsing log lines is faster than ever, after a series of performance optimizations to log-related components.

### Logs: See more log lines in logs context

<!-- Gabor Farkas, Sven Grossmann -->

_Generally available in all editions of Grafana._

Log context allows you to view additional lines surrounding a specific log entry. With this enhancement, you can access as many log lines as needed within the log context. As you scroll through the logs, Grafana dynamically loads more log lines, ensuring a seamless and continuous viewing experience.

### Elasticsearch logs sample

<!-- Gareth Dawson -->

_Generally available in all editions of Grafana._

For Elasticsearch metric queries in Explore, you can now see the sample of log lines that contributed to the displayed results. To see these logs, click on the collapsed Logs sample panel under your graph or table panel. If you want to interact with your log lines or modify the log query, click on the “Open logs in split view” button and the log query will be executed in the split view.

### Panel plugins in Explore

<!-- Ben Donnelly -->

_Experimental in all editions of Grafana_

Data source plugin developers can now use any plugin to visualize data in Explore. Similar to `preferredVisualizationType`, we've introduced an experimental API to render visualizations by plugin ID. In the returned data frame, set the meta option `preferredVisualisationPluginId` to the plugin ID you want to be used when showing the data for given data frame.

## Alerting

_All Alerting features are generally available in all editions of Grafana._

We’ve made a number of improvements to simplify the alert rule creation process as well as improvements to contact points and alert management. For all the details, refer to our Alerting documentation.

### Alert rules

We’ve made the following changes to alert rules.

#### Alert instance routing preview

_This feature is for Grafana-managed alert rules only._

Preview how your alert instances will be routed if they fire while you are creating your alert rule. View routing for each Alertmanager you have configured to receive Grafana-managed alerts and if required, you can easily make adjustments to your custom labels to change the way your alert instances are routed.

{{< figure src="/media/docs/alerting/alert-routing-preview.png" max-width="750px" caption="Alert instance routing preview" >}}

#### Alert rule types

Enables you to switch to a data source-managed alert rule if your data source is configured to support alert rule creation (Ruler API enabled). By default, the alert rule type is Grafana-managed.

{{< figure src="/media/docs/alerting/alert-rule-types.png" max-width="750px" caption="Alert rule types" >}}

#### UI improvements

- **Alert evaluation behavior**: New UI components for creating a folder and adding an evaluation group along with improved text and validation.
- **Alert Rule list page**: the process of creating recording rules (More drop down) is now separate from Grafana-managed and data source-managed alert rules (**+New alert rule**)
  .
- **Annotations display**: Adding a summary, description, and runbook URL as annotations are now optional. The dashboard and panel names are now also linked directly, making it easier to access.
- **View YAML button**: Displays alert rule configuration in YAML format on the Grafana-managed alert rules form as well as Grafana-managed provisioned and non-provisioned Alert Rule detail view.
- **Queries and expressions**: Several improvements have been made to the display of queries and expressions, including making Add expression a dropdown and moving Conditions to the header.
- **Min interval option**: Improves control over query costs and performance by enabling you to adjust the minimum resolution of the data used in your alerting queries.
- **In-app guidance for alert rule creation**: Learn about how to create your alert rules interactively with in-app guidance for additional context and links out to our Alerting documentation.
- **Support for toggling common labels**: Toggle between showing or hiding labels for each individual alert instance.

### Contact points

We’ve made the following changes to contact points.

#### Additional contact points for external Alertmanager

Adds support for the following contact points when using an external Alertmanager:

- WeChat
- Amazon SNS
- Telegram
- Cisco Webex Teams

#### Contact point provisioning file export

Facilitates file provisioning and maintenance for contact points.This feature implements the provisioning API export endpoints for exporting contact points as well as adding export buttons to the contact point list in the UI.

### Notification policies

We’ve made the following changes to notification policies.

#### Notification policy provisioning file export

Facilitates file provisioning and maintenance for notification policies.This feature implements the provisioning API export endpoints for exporting notification policies as well as adding an export button to the root notification policy in the UI.

### Alert management

We’ve made the following changes to alert management.

#### Support for timezones in mute timings

Adds support for different time zones and locations as well as a visual selector for week days, improvement to loading and error handling, and better validation for time ranges.

{{< figure src="/media/docs/alerting/timezone-support.png" max-width="750px" caption="Time zone support" >}}

#### Label colors for alert instances

Labels are colored according to the label key, which makes it easier to track and view labels across alert instances.

## Authentication and authorization

### OAuth role mapping enforcement

<!-- Jo Guerreiro, AuthNZ -->

_Generally available in Grafana Open Source, Enterprise, and Cloud._

This change impacts `GitHub` OAuth, `Gitlab` OAuth, `Okta` OAuth and `Generic` OAuth.

Currently if no organization role mapping is found for a user when connecting using OAuth, Grafana doesn’t update the user’s organization role.

With Grafana 10.1, on every login, if the `role_attribute_path` property does not return a role, then the user is assigned the role specified by the `auto_assign_org_role` option or the default role for the organization, by default, Viewer.

To avoid overriding manually set roles, enable the `skip_org_role_sync` option in the Grafana configuration for your OAuth provider before the user logs in for the first time.

### Preventing manual role updates for externally synced roles

<!-- Ieva Vasiljeva, AuthNZ -->

_Generally available in Grafana Open Source, Enterprise, and Cloud._

This change impacts all instances that use an external authentication provider and have [role mapping enabled.

Currently, it is possible to manually update a user's organization role (Viewer, Editor or Admin) even if this role is managed by an external authentication provider.
This means that roles can be manually set for the duration of a user's session, but are overridden by the external authentication provider the next time the user logs in.
If the `onlyExternalOrgRoleSync` feature toggle is enabled, manual role updates for externally managed roles are not allowed.

With Grafana 10.1, you can no longer manually update externally managed organization roles.
We have removed this feature toggle with Grafana 10.1, and have defaulted to locking the organization role of users authenticated by an external provider.

If you prefer to manage your users' organization roles manually, enable the `skip_org_role_sync` option in the Grafana configuration for your authentication provider.

Refer to the [release notes of Grafana 9.5]({{< relref "../whatsnew/whats-new-in-v9-5/#auth-lock-organization-roles-synced-from-auth-providers" >}}) for context on the previous work done to build up to this change.

### GitLab OIDC support

<!-- Jo Guerreiro, AuthNZ -->

_Generally available in Grafana Open Source, Enterprise, and Cloud._

Grafana 10.1 now supports GitLab OIDC through the `GitLab` OAuth provider in addition to the existing `GitLab` OAuth2 provider. This allows you to use GitLab OIDC to authenticate users in Grafana.

This allows Grafana to reduce the access scope to only the required scopes for authentication and authorization instead
of full read API access.

To learn how to migrate your GitLab OAuth2 setup to OIDC, refer to our [GitLab authentication documentation]({{< relref "../setup-grafana/configure-security/configure-authentication/gitlab/" >}}).

### Google OIDC and Team Sync support

<!-- Jo Guerreiro, AuthNZ -->

_Generally available in Grafana Open Source, Enterprise, and Cloud._

Grafana 10.1 now supports Google OIDC through the `Google` OAuth provider in addition to the existing `Google` OAuth2 provider. This allows you to use Google OIDC to authenticate users in Grafana, which in turn lets Grafana reduce the access scope to only the required scopes for authentication and authorization.

This release also adds support for Google OIDC in Team Sync. You can now easily add users to teams by using their Google groups.

To learn how to migrate your Google OAuth2 setup to OIDC and how to set up Team Sync, refer to our [Google authentication documentation]({{< relref "../setup-grafana/configure-security/configure-authentication/google/" >}}).

## Plugins

### Angular deprecation changes

<!-- Giuseppe Guerra, Plugins Platform -->

_Generally available in all editions of Grafana._

We've made the following updates in Grafana 10.1 to increase awareness of [Angular deprecation]({{< relref "../developers/angular_deprecation/" >}}) and its side effects in future releases of Grafana:

#### UI changes

- Added an "Angular" badge next to affected plugins in the plugins catalog.
- Added an alert at the top of a plugin's page in the plugins catalog when browsing Angular plugins.
- Added an alert at the top of the query editor when editing panels which use Angular data source plugins.

#### Other changes

- Angular Plugins will not be loaded if [angular_support_enabled]({{< relref "../setup-grafana/configure-grafana/#angular_support_enabled" >}}) is set to `false`.

You can [refer to our documentation]({{< relref "../developers/angular_deprecation/" >}}) to learn more about Angular deprecation.

### Deprecated provisioning of data sources with invalid UIDs

<!-- Giuseppe Guerra, Plugins Platform -->

_Generally available in all editions of Grafana._

Grafana 10.1 logs an error when provisioning data sources with invalid UIDs. A valid uid is a combination of a-z, A-Z, 0-9 (alphanumeric), `-` (dash) and `_` (underscore) characters, maximum length 40.

**Provisioning data sources with invalid UIDs will be removed in future versions of Grafana, and will return an error instead.**

## Subfolders: folder selection

<!-- Zsofia Komaromi -->

_Available in public preview in Grafana Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced_

When saving or moving a dashboard, you can now see the full folder tree when selecting the destination folder.

To get started creating subfolders, enable the `nestedFolders` feature toggle. We recommend that you enable this feature only on test or development instances, rather than in production environments.

{{< figure src="/media/docs/grafana/screenshot-grafana-10.1-subfolders-folder-picker.png" max-width="750px" caption="Selecting a folder in Grafana" >}}

## Activate draft reports

<!-- Robert Horvath -->

_Generally available in Grafana Enterprise, Cloud Free, Cloud Pro, Cloud Advanced_

You can now use the resume and pause report functionality to activate draft reports that have all the required fields filled in.

To learn more, refer to our [create and manage reports documentation]({{< relref "../dashboards/create-reports" >}}).
