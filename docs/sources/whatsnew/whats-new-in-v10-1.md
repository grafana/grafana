---
description: Feature and improvement highlights for Grafana v10.1
keywords:
  - grafana
  - new
  - documentation
  - '10.1'
  - release notes
title: What's new in Grafana v10.1
weight: -38
---

# What’s new in Grafana v10.1

Welcome to Grafana 10.1! Read on to learn about changes to search and navigation, dashboards and visualizations, and security and authentication.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.1, check out our [Upgrade Guide]({{< relref "../upgrade-guide/upgrade-v10.1/index.md" >}}).

<!-- Template below
## Feature
<!-- Name of contributor -->
<!-- [Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).
{{% /admonition %}}
-->

## Dashboards and visualizations

### Disconnect values in time series, trend, and state timeline visualizations

_Generally available in all editions of Grafana._

<!-- Nathan Marrs -->

You can now choose whether to set a threshold above which values in the data should be disconnected. This can be useful in cases where you have sensors that report a value at a set interval, but you want to disconnect the values when the sensor does not respond. This feature complements the existing [connect null values functionality]({{< relref "../panels-visualizations/visualizations/time-series/#connect-null-values" >}}).

To learn more, refer to our [disconnect values documentation]({{< relref "../panels-visualizations/visualizations/time-series/#disconnect-values" >}}).

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-disconnect-values-examples.png" max-width="750px" caption="Disconnect values in time series, trend, and state timeline visualizations" >}}

### Flamegraph improvements

_Generally available in all editions of Grafana._

<!-- Andrej Ocenas -->

We have added 4 new features to the flamegraph visualization:

- **Sandwich view**: You can now show a sandwich of any symbol in the flamegraph. Sandwich view will show all the callers on the top and all the callees of the symbol on the bottom. This is useful when you want to see the context of a symbol.
- **Switching color scheme**: You can now switch color scheme between color gradient by the relative value of a symbol or by package name of a symbol.
- **Switching symbol name alignment**: With symbols with long name it may be problematic to differentiate them if they have the same prefix. This new option allows you to align the text to left or right so that you can see the part of the symbol name that is important.
- **Improved navigation**: You can also highlight a symbol or switch on sandwich view for a symbol from the table. Also, a new status bar on top of the flamegraph gives you an overview of which views are enabled.

{{< video-embed src="/media/docs/grafana/panels-visualizations/screen-recording-grafana-10.1-flamegraph-whatsnew.mp4" >}}

### Transformations redesign

The transformations tab has gotten an improved user experience and visual redesign! Now you can view transformations with categories and illustrations.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-transformations.png" max-width="750px" caption="Transformations redesign" >}}

### Logs: Log rows menu when using displayed fields

<!-- Matías Wenceslao Chomicki -->

_Generally available in all editions of Grafana._

When you're browsing logs you can use the Log Details component, that is displayed when you click on a row, to replace the log lines contents with the value of one or more of the log fields or labels by using the "eye" icon. When this feature is in use, you now have access to the menu displayed on mouse-over with options such as show context (if available), copy log to clipboard, or copy shortlink.

### Logs: Improved rendering performance of log lines

<!-- Matías Wenceslao Chomicki -->

_Generally available in all editions of Grafana._

With Grafana 10.1 browsing log lines is faster than ever before after a series of performance optimizations done for log-related components.

### Visualizations and Widgets split

<!-- Alexa Vargas, Juan Cabanas -->

_Experimental in all editions of Grafana._

This experimental feature introduces a clear distinction between two different categories of panel plugin types: visualization panels that consume a data source and a new type called _widgets_ that don't require a data source.

Now, you can easily add widgets like Text, News, and Annotation list without the need to select a data source. The plugins list and library panels are filtered based on whether you've selected a widget or visualization, providing a streamlined editing experience.

To try out the visualizations and widgets split, enable the `vizAndWidgetSplit` feature toggle. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support.

{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="New widget option added to empty dashboards" >}}

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

_Generally available in all editions of Grafana._

Grafana's Tempo data source latest upgrade includes support for streaming responses of TraceQL queries. With this feature, you can now see partial query results as they come in, so no more waiting for the whole query to finish. This is perfect for those long queries that take a long time to return a response.

To use this feature, toggle on the "Stream response" option in either the Search or TraceQL query type, and you'll get immediate visibility of incoming traces on the results table. This smooth integration makes data exploration a breeze and speeds up decision-making.

{{< video-embed src="/media/docs/grafana/data-sources/tempo-streaming.mp4" >}}

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

{{< figure src="/media/docs/tempo/screenshot-grafana-tempo-span-filters-v10-1.png" max-width="750px" caption="Traces span filtering" >}}

### Configuration page redesign for Loki and Elasticsearch

<!-- Matías Wenceslao Chomicki -->

_Generally available in all editions of Grafana._

Loki and Elasticsearch data source configuration pages have been redesigned to make getting started and setting up data sources as simple and easy to understand as possible. You can now find new subsections with links to configuration pages and tooltips to assist you with configuring and customizing data sources.

### Loki query splitting

<!-- Matías Wenceslao Chomicki -->

_Generally available in all editions of Grafana._

In response to different query performance scenarios, we implemented query splitting, where queries that request more than a day of data are split in sub-requests of 1 day duration each. For example, requesting 7 days of logs will produce 7 requests of 1 day.

### Metrics explorer

The Metrics Explorer is a new feature to enhance metric browsing in the Prometheus query builder. The Metrics Explorer makes it easier for you to find the right metric, and get comfortable with PromQL. You can now explore metrics with additional metadata, perform fuzzy search on the metric name / description, and filter on the Prometheus type.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-metrics-explorer.png" max-width="750px" caption="Metrics explorer" >}}

### CloudWatch Logs Monaco query editor

<!-- Isabella Siu, Kevin Yu -->

_Experimental in all editions of Grafana_

The CloudWatch Logs query editor is moving from being a Slate-based editor to a Monaco-based editor. This new Monaco-based editor will provide improved syntax highlighting, and auto-completion. Enable the `cloudWatchLogsMonacoEditor` feature toggle to use the Monaco-based query editor. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support.

## Explore

### Elasticsearch logs sample

<!-- Gareth Dawson -->

_Generally available in all editions of Grafana._

For Elasticsearch metric queries in Explore, you can now see the sample of log lines that contributed to the displayed results. To see these logs, click on the collapsed Logs sample panel under your graph or table panel. If you want to interact with your log lines or modify the log query, click on the “Open logs in split view” button and the log query will be executed in the split view.

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

This change impacts all instances that use an external authentication provider and have [role mapping]({{< relref "../setup-grafana/configure-security/planning-iam-strategy/#role-sync" >}}) enabled.

Currently, it is possible to manually update a user's organization role (Viewer, Editor or Admin) even if this role is managed by an external authentication provider.
This means that roles can be manually set for the duration of a user's session, but are overridden by the external authentication provider the next time when the user logs in.

With Grafana 10.1, you can no longer manually update an externally managed organization role. Role locking was previously behind `onlyExternalOrgRoleSync` feature toggle.
We have removed this feature toggle with Grafana 10.1, and made externally synced role locking the default behaviour.

If you prefer to manage your users' organization roles manually, enable the `skip_org_role_sync` option in the Grafana configuration for your OAuth provider.

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
