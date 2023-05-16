---
description: Feature and improvement highlights for Grafana v10.0
keywords:
  - grafana
  - new
  - documentation
  - '10.0'
  - release notes
title: What's new in Grafana v10.0
weight: -37
---

# What’s new in Grafana v10.0

Welcome to Grafana 10.0! Read on to learn about changes to search and navigation, dashboards and visualizations, and authentication and security. For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

<!-- Template below
## Feature
<!-- Name of contributor -->
<!-- [Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
> **Note:** You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).-->

## Correlations

<!-- Jay Goodson -->

_Available in preview in all editions of Grafana._

You can now bring context from multiple data sources into the Explore experience. Correlations is an extension of our existing Data Links functionality and now enables you to link from any data source, to any data source.

Correlations enable you to seamlessly jump from one data source to another. You define relationships between your different data sources, and when Exploring simply click a button next to a related field in one data source and Grafana will run the corresponding query in the other datasource.

Correlations is currently in preview. As such, it is recommended to enable it only on test or development instances, rather than in production environments.

To try out Correlations, you'll need to enable the `correlations` feature toggle. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support.

In subsequent releases, we’ll be refining and enhancing the user interface for Correlations, to provide a more streamlined user experience.

## Scenes

<!--Dominik Prokop & Natalia Bernarte -->

_Available in Experimental in all editions of Grafana._

Scenes is a new front-end library by Grafana that empowers application engineers to effortlessly build stunning dashboard experiences right into their products. With Scenes, you can easily create apps that mirror the Grafana dashboarding experience, complete with template variable support, flexible layouts, dynamic panel rendering, and so much more.

To try it out, please check [@grafana/scenes](https://github.com/grafana/scenes).

<!--
- TODO: Add link to docs and resources
-->

## Subfolders

<!-- Zsofia K. -->

_Available in preview in all editions of Grafana._

You can now create subfolders in Grafana to help you better organize your dashboards and alerts. This new feature allows you to create, read, update, and delete subfolders, making it easier to sort resources by business units, departments, and teams.

You can also set up permissions using Role-Based Access Control (RBAC). Folder permissions will cascade, being inherited from the parent folder, which simplifies access management.

The ability to add subfolders is currently in preview. As such, it's recommended to enable it only on test or development instances, rather than in production environments.

To get started creating subfolders, you'll need to enable the `nestedFolders` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

In subsequent releases, we’ll be refining and enhancing the user interface for managing dashboards and folders, to provide a more streamlined user experience.

{{< figure src="/media/docs/grafana/screenshot-grafana-10.0-nested-folders.png" max-width="750px" caption="Subfolders in Grafana" >}}

## Dashboards and visualizations

### The Canvas panel is GA

<!-- Nathan Marrs -->

We are promoting the canvas panel out of beta and into general availability. Over the past several months we have introduced multiple enhancements to the panel such as the ability to draw connections between elements, the ability to set the color and size of connections based on data, and the ability to add data links. We are excited to include canvas as a first class citizen in Grafana’s core panel library. To learn more about the Canvas panel, refer to [Canvas]({{< relref "../panels-visualizations/visualizations/canvas" >}}). Also, check out [our latest blog post about canvas](https://grafana.com/blog/2023/05/11/use-canvas-panels-to-customize-visualizations-in-grafana/).

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-canvas-service-graph.png" max-width="750px" caption="Canvas service graph" >}}

### New Trend Panel

<!-- Nathan Marrs -->

_Available in Experimental in all editions of Grafana_

We are excited to introduce a new panel that allows you to display trends where the x axis is numeric and not time. This new beta panel addresses gaps that were not solved by either the Time series or XY Chart panels. For example, you can plot function graphs, rpm / torque curves, supply / demand relationships, and more. To learn more about the Trend panel, refer to [Trend]({{< relref "../panels-visualizations/visualizations/trend" >}}).

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-trend-panel-new-colors.png" max-width="750px" caption="Trend engine power and torque curves" >}}

### Drag and Drop spreadsheets into Grafana

_Available in Experimental in all editions of Grafana_

<!-- Oscar Kilhed -->

it's easier than ever to view local data in Grafana - welcome drag & drop!
The drag & drop functionality allows you to upload your csv, excel or numbers files by simply dragging and dropping them into the query editor of the Grafana data source.

Drag & drop feature is disabled by default. In order to use drag and drop, enable the `editPanelCSVDragAndDrop` feature toggle.

As of Grafana 10, drag & drop supports the following scenarios:

- Drag & drop files into the panel editor
- Replace files in the panel editor
- Default table panel creation

Data is being stored in the dashboard json and has a 1MB size limit. To learn more about drag & drop, please refer to the official documentation.

<!-- TODO: Add docs link above -->

### Select your data source more easily

<!-- Ivan Ortega & Natalia Bernarte -->

_Generally available in all editions of Grafana._

Concepts like data sources and dashboards panels are hard to grasp and it’s a struggle to go from Grafana’s “empty state” to a working dashboard that displays data. Our latest advancements streamline the process of selecting the ideal data source in Grafana, prioritizing recent usage and providing labels and supplementary descriptions.

With this flow, selecting a data source has been greatly simplified, providing a clear overview of available data sources and allowing you to quickly connect to a new one when needed. You can also quickly upload a CSV file.

{{< video-embed src="/media/docs/grafana/screen-recording-ds-picker-whats-new-10-final.mp4" max-width="750px" caption="Datasource picker flow" >}}

### Time series time region support

_Generally available in all editions of Grafana._

<!-- Nathan Marrs -->

We have implemented support for adding time regions to the time series panel. Time regions provide a more contextualized experience, enabling you to highlight certain days of the week, such as Monday-Friday to display work weeks right alongside your data. Time regions are a useful way to highlight specific parts of a day like night, work hours, or whatever you define for each day. They allow the viewer to quickly orient themselves in parts of the day and/or ignore highlighted parts of the time series.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-time-regions.png" max-width="750px" caption="Time regions" >}}

### Annotation filtering

_Generally available in all editions of Grafana._

<!-- Nathan Marrs -->

We’ve improved the way you can configure annotations by adding the possibility to apply annotations to all panels, selected panels or to select the panels by exclusion.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-0-annotation-filtering.png" max-width="750px" caption="Annotation filtering" >}}

### Redesigned and improved Log Context

_Generally available in all editions of Grafana._

<!-- Sven Grossman -->

We've made enhancements to Grafana's log context feature, resulting in a more seamless and consistent user experience. With the updated user interface, you can expect the same level of functionality and usability in log context as you would in any other logs panel.

Notably, we've added the following new features that streamline the log context experience:

1. Log details with actions including a **Copy** button to easily copy lines and an eye icon to display only selected labels, allowing users to focus on specific information without leaving the log context panel.
2. A **Wrap Lines** toggle to automatically wrap long lines of text for easier reading and analysis of log entry context directly in log context.
3. An **Open in split view** button to execute the context query for a log entry in a split screen in the Explore view.
4. Only for Loki: A quick filter menu that lets you easily refine the context query by selecting and removing labels.

{{< figure src="/media/docs/grafana/log-context-loki-new-whats-new-10-0.png" max-width="750px" caption="Grafana Log Context" >}}

These improvements make working with log context in Grafana more intuitive and efficient, ultimately improving the overall user experience.

### Query multiple data sources in Explore

<!-- Piotr Jamroz -->

_Generally available in all editions of Grafana._

You can now query multiple data sources simultaneously in Explore. Select "Mixed" from the data source picker and specify a data source for each query.

The "Mixed" data source in Explore is gradually rolling out to all users on Grafana Cloud. If you’re using Grafana Open Source or Enterprise, you can disable this feature using the `exploreMixedDatasource` feature toggle.

## Public dashboards

<!-- Juani Cabanas & Ezequiel Victorero & Natalia Bernarte -->

_Available in preview in all editions of Grafana._

Public dashboards allow you to share your Grafana dashboard with anyone without requiring them to log in to Grafana. This is useful when you want to make your dashboard available to the world.

With this update, we've made the following improvements:

- The time picker and annotations can be toggled on or off in public dashboard configuration
- You can see a list of all your public dashboards in **Dashboards > Public dashboards**
- Improved UI: new modal design, paused and not found pages
- Added support for collapsed rows, hidden queries, and zoom into panels

To try it out, you'll need to enable the `publicDashboards` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

To learn more, check out our public dashboards [documentation]({{< relref "../../dashboards/dashboard-public" >}}).

### Public dashboards insights

<!-- Juani Cabanas & Ezequiel Victorero & Natalia Bernarte -->

_Available in preview in Grafana Enterprise, Cloud Pro, and Cloud Advanced._

Public dashboards insights provide valuable information about your public dashboard usage. You can easily access and view important metrics such as the daily query count, the number of views in the last 30 days, and the number of errors in the last 30 days.

To try it out, you'll need to enable the `publicDashboards` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

### Email sharing for public dashboards

<!-- Juani Cabanas & Ezequiel Victorero & Natalia Bernarte -->

_Available in public preview in Cloud Pro and Cloud Advanced._

Our email sharing feature allows you to easily share your public dashboards and make them visible only with specific individuals. When you add their email addresses, they will receive a one-time link to access the dashboard. This provides you with greater control over who can view your public dashboards.

We've also added a **Public dashboard users** tab in **Administration > Users** where you can view a list of users who have accessed your public dashboards by way of a email sharing.

To try it out, please contact customer support.

This feature will have a cost by active users after being promoted into general availability.

To learn more, check out our public dashboards [documentation]({{< relref "../../dashboards/dashboard-public" >}}).

## Authentication and authorization

### Configure your SAML provider in the Grafana UI

<!-- Vardan Torosyan -->

_Generally available in Grafana Enterprise, Cloud Pro, and Cloud Advanced._

You can now configure SAML using our new user interface, making the process easier and more convenient than ever before.
With the new user interface, you can now configure SAML without needing to restart Grafana and you can control access to the configuration UI by using [role-based access control (RBAC)]({{< relref "../administration/roles-and-permissions/access-control/" >}}), which makes the process much faster and more efficient.

The SAML UI is available in Grafana Enterprise and Grafana Cloud Pro and Advanced. It is intuitive and user-friendly, with clear instructions and helpful prompts to guide you through the process.

For more information on how to set up SAML using the Grafana UI, refer to [Configure SAML authentication using the Grafana user interface]({{< relref "../setup-grafana/configure-security/configure-authentication/saml-ui/" >}}).

### Case-insensitive usernames and email addresses

<!-- Vardan Torosyan -->

_Generally available in all editions of Grafana._

Usernames and email addresses are now treated as case-insensitive, which means that you will no longer need to worry about capitalization when logging in or creating an account.

From now on, whether you type your username or email address in uppercase, lowercase, or a combination of both, Grafana will treat them as the same. This will simplify the login process, reduce the risk of typos and identity conflicts when changing authentication providers.

To help you with dealing with potential user identity conflicts, we have built a [Grafana CLI user identity conflict resolver tool](https://grafana.com/blog/2022/12/12/guide-to-using-the-new-grafana-cli-user-identity-conflict-tool-in-grafana-9.3/) which is available since Grafana 9.3.

Note that if you are running Grafana with MySQL as a database, this change does not have any impact as MySQL users were already treated as case-insensitive.

## Tracing

### Span filtering for traces

<!-- Timur Olzhabayev -->

_Available in preview in all editions of Grafana._

You can now work much more efficiently with traces that consist of a large number of spans.

The span filters exist above the trace view, and allow you to filter the spans that are shown in the trace view. The more filters you add, the more specific are the filtered spans.

Currently, you can add one or more of the following filters:

- Service name,
- Span name,
- Duration,
- Tags (which include tags, process tags, and log fields).

To try it out, you'll need to enable the `newTraceView` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

### OpenTelemetry replacing OpenTracing

<!-- Timur Olzhabayev -->

We have started our work to migrate to OpenTelemetry in Grafana 8.4 and now we are removing OpenTracing and replacing it, for those that still have it configured, with OpenTelemetry under the hood. The changes are made in backwards compatible way so that users of Grafana do not need to change anything and they will continue working in the same way as before.

## Data sources

### Azure Monitor data source

<!-- Andreas Christou -->

The Azure Monitor datasource now supports visualizing Application Insights Traces. A new query type `Traces` has been added to the service list. This can be utilised against Application Insights resources to query and visualize traces in both a tabular format and using the built-in Traces visualization.

This also includes support for a new Azure API that will correlate trace ID's against all Application Insights resources that are accessible to the principal that the datasource is configured with. To support this feature a new query builder has been added with support for querying the Application Insights resource using an `Operation ID` or visualizing and filtering the data based on the event type and a subset of the properties available on the trace.

### Prometheus dashboard performance improvements

<!-- Galen Kistler -->

_This is an experimental feature_

As of Grafana 10, the Prometheus datasource supports delta (incremental) querying, in which values from data frames are cached and leveraged to modify future requests to avoid requesting duplicate values in dashboards with now-relative (i.e. any dashboard querying until "now") queries. This feature is disabled by default as it is still experimental, but can be turned on and configured in the Prometheus data source configuration.
This will reduce network load, and speed up now-relative dashboards, especially for dashboards returning lots of data.

### Phlare renamed to Grafana Pyroscope

<!-- Andrej Ocenus -->

As a part of ongoing unification of Phlare and Pyroscope project we are renaming the Phlare data source to Grafana Pyroscope data source. This data source will support both Phlare and Pyroscope backends. Existing instances of the data source should not be affected. When creating new instance of the data source, backend type will be autodetected on the config page, or you can select it manually.

### Data plane

<!-- Kyle Brandt -->

Starting with Grafana 10, data types are being defined to create a data plane layer between producers and consumers of data. By defining data types as part of Grafana's platform, plugin and application developers can use these data types to achieve more reliable interoperability across the platform.

Resources:

- [Data Plane Contract - Technical Specification](https://grafana.github.io/dataplane/contract/)
- [Example Typed Dataframes and Go lib to use them in tests](https://github.com/grafana/dataplane/tree/main/examples)
- [Go library for reading and writing dataplane data](https://github.com/grafana/dataplane/tree/main/sdata)

## Alerting

### State history view

<!-- Brenda Muir -->

Use the improved State history view to get insight into how your alert instances behave over time. View information on when a state change occurred, what the previous state was, the current state, any other alert instances that changed their state at the same time as well as what the query value was that triggered the change.

### Preview notification templates

<!-- Brenda Muir -->

Preview how your notification templates will look before using them in your contact points.

## Security

### Trusted Types support

<!-- Tobias Skarhed -->

_In development, available in all editions of Grafana._

Use [trusted types](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/trusted-types) to reduce the risk of XSS vulnerabilities. This is an experimental web technology with limited browser support. One aspect of it is sanitization of third party libraries or plugins that have not explicitly done sanitization.

To use it in report only mode:

- Enable `content_security_policy_report_only` in the configuration.
- Add `require-trusted-types-for 'script';` to the `content_security_policy_report_only_template`.

To use it in enforce mode:

- Enable `content_security_policy` in the configuration.
- Add `require-trusted-types-for 'script';` to the `content_security_policy_template`.

### Private data source connect

<!-- Mitch Seaman -->

_Available in Public Preview in Grafana Cloud Pro and Advanced._

Some data sources, like MySQL databases, Prometheus instances or Elasticsearch clusters, run in Private Networks, like onprem networks or virtual private clouds (VPCs) running in AWS, GCP, or Azure.

In order to query these data sources from Grafana Cloud, currently you have to open your private network to a range of IP addresses - this is a non-starter for a lot of IT Security teams. So the challenge is, how do you connect to your private data from Grafana Cloud, without exposing your network?

The answer is Private Data Source Connect (PDC), available now in Public Preview in Grafana Cloud Pro and Advanced. PDC uses SOCKS over SSH to establish a secure connection between a lightweight PDC agent you deploy on your network and your Grafana Cloud stack. PDC keeps the network connection totally under your control. It’s easy to set up and manage, uses industry-standard security protocols, and works across public cloud vendors and a wide variety of secure networks. Learn more in our [docs](https://grafana.com/docs/grafana-cloud/data-configuration/configure-private-datasource-connect/).

## Deprecations

Starting with 10.0, changing the folder UID through the API is deprecated. It will be removed in a future release.
