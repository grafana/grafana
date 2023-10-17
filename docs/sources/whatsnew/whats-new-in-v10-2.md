---
description: Feature and improvement highlights for Grafana v10.2
keywords:
  - grafana
  - new
  - documentation
  - '10.2'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v10.2
weight: -39
---

# What’s new in Grafana v10.2

Welcome to Grafana 10.2! Read on to learn about changes to ...

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.2, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v10.2/).

<!-- Template below

> Add on-prem only features here. Features documented in the Cloud What's new will be copied from those release notes.

## Feature
<!-- Name of contributor -->
<!-- _[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
Use full URLs for links. When linking to versioned docs, replace the version with the version interpolation placeholder (for example, <GRAFANA_VERSION>, <TEMPO_VERSION>, <MIMIR_VERSION>) so the system can determine the correct set of docs to point to. For example, "https://grafana.com/docs/grafana/latest/administration/" becomes "https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/".
{{% /admonition %}}
-->
<!-- Add an image, GIF or video  as below

{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="DESCRIPTIVE CAPTION" >}}

Learn how to upload images here: https://grafana.com/docs/writers-toolkit/write/image-guidelines/#where-to-store-media-assets
-->

## Public dashboards

<!-- Thanos Karachalios -->

_Generally Available in Grafana Open Source and Enterprise_

Public dashboards allow you to share your visualizations and insights to a broader audience without the requirement of a login. You can effortlessly use our current sharing model and create a public dashboard URL to share with anyone using the generated public URL link. To learn more, refer to the [Public dashboards documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/dashboard-public/), as well as the following video demo:

{{< video-embed src="/media/docs/grafana/dashboards/public-dashboards-demo.mp4" >}}

## Recorded queries: Record multiple metrics from a single query

<!-- Kyle Brandt, Observability Metrics -->

_Generally available in Grafana Enterprise_

With recorded queries, a single recorded query can now record multiple metrics.

## Dashboards and visualizations

### Generative AI features for dashboards

// Is this actually generally available given steps of needing to also install LLM plugin / have openAI key?
_Generally available in all editions of Grafana_

<!-- Nathan Marrs -->

You can now use generative AI to assist you in your Grafana dashboards. So far generative AI can help you with the following tasks:

- **Generate panel titles and descriptions** - You can now generate a title and description for your panel based on the data you've added to it. This is useful when you want to quickly create a panel and don't want to spend time coming up with a title or description.
- **Generate dashboard titles and descriptions** - You can now generate a title and description for your dashboard based on the panels you've added to it. This is useful when you want to quickly create a dashboard and don't want to spend time coming up with a title or description.
- **Generate dashboard save changes summary** - You can now generate a summary of the changes you've made to a dashboard when you save it. This is useful when you want to quickly save a dashboard and don't want to spend time coming up with a summary.

TODO - how can they use / access these features?? Link to some form of documentation or just say "more info coming soon"?

TODO: Add image / gif / video

### Calculate visualization min/max individually per field

<!-- Oscar Kilhed -->

_Generally available in Grafana Open Source and Enterprise_

When visualizing multiple fields with a wide spread of values, calculating the min or max value of the visualization based on all fields can hide useful details.
{{< figure src="/media/docs/grafana/panels-visualizations/globalminmax.png" max-width="300px" caption="Stat panel visualization with min/max calculated from all fields" >}}

In this example in the stat visualization, it's hard to get an idea of how the values of each series relate to the historical values of that series. The threshold of 10% is exceeded by the A-series even though the A-series is below 10% of its historical maximum.

Now, you can automatically calculate the min or max of each visualized field based on the lowest and highest value of the individual field. This setting is available in the standard options of most visualizations.

{{< figure src="/media/docs/grafana/panels-visualizations/localminmax.png" max-width="300px" caption="Stat panel visualization with min/max calculated per field" >}}
In this example, using the same data, with the min and max calculated for each individual field, we get a much better understanding of how the current value relates to the historical values. The A-series no longer exceeds the 10% threshold; in fact, it's now clear that it's at a historical low.

This is not only useful in the stat visualization; gauge, bar gauge, and status history visualizations, table cells formatted by thresholds, and gauge table cells all benefit from this addition.

### New browse dashboards

<!-- Yaelle Chaudy for Frontend Platform -->

_Generally available in Grafana Open Source and Enterprise_

The new browse dashboards interface features a more compact design, making it easier to navigate, search for, and manage for your folders and dashboards. The new interface also has many performance improvements, especially for instances with a large number of folders and dashboards.

To make using folders easier and more consistent, there is no longer a special **General** folder. Dashboards without a folder, or dashboards previously in **General**, are now shown at the root level.

To learn more, refer to the following video demo.

{{< video-embed src="/media/docs/grafana/2023-09-11-New-Browse-Dashboards-Enablement-Video.mp4" >}}

### New Canvas button element

_Available in public preview in all editions of Grafana_

<!-- Nathan Marrs -->

You can now add buttons to your Canvas visualizations. Buttons can be configured to call an API endpoint. This pushes Grafana's capabilities to new heights, allowing you to create interactive dashboards that can be used to control external systems.

To learn more, refer to our [Canvas button element documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/#TODO).

TODO: Add image / gif / video

### Time series visualization now support y-axis zooming

_Generally available in all editions of Grafana_

<!-- Nathan Marrs -->

You can now zoom in on the y-axis of your time series visualizations. This is useful when you want to focus on a specific range of values.

To learn more, refer to our [Time series documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/TODO).

TODO: Add image / gif / video

### Visualize enum data in Time series and State timeline visualizations

_Generally available in all editions of Grafana_

<!-- Nathan Marrs -->

You can now visualize enum data in the Time series and State timeline visualizations. To visualize enum data you must first convert the field to an enum field via the Convert field type transformation.

TODO: Add image / gif / video

### Data visualization quality of life improvements

_Generally available in all editions of Grafana_

<!-- Nathan Marrs -->

TBD / WIP - some high level thoughts

- Geomap marker symbol alignment options (https://github.com/grafana/grafana/pull/74293)
- Bar chart improvements (https://github.com/grafana/grafana/pull/75136)
- Gauge styling updates?
- Exemplar tooltip config (if it makes it for 10.2)
- ?

TODO: Add image / gif / video (maybe not for this one)

## Data sources

### Tempo data source: "Aggregate By" Search option to compute RED metrics over spans aggregated by attribute

<!-- Joey Tawadrous, Jen Villa -->

_Experimental in Grafana Open Source and Enterprise_

(Requires Tempo or Grafana Enterprise Traces (GET) v2.2 or greater)

We've added an **Aggregate By** option to the [TraceQL query editor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/traceql-search/#write-traceql-queries-using-search) to leverage Tempo's [metrics summary API](https://grafana.com/docs/tempo/<TEMPO_VERSION>/api_docs/metrics-summary/). You can calculate RED metrics (total span count, percent erroring spans, and latency information) for spans of `kind=server` received in the last hour that match your filter criteria, grouped by whatever attributes you specify.

This feature is disabled by default. To enable it, use the `metricsSummary` [experimental feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#experimental-feature-toggles).

For more information, refer to the [documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/traceql-search/#optional-use-aggregate-by).

{{< figure src="/media/docs/tempo/metrics-summary-10-2.png" caption="Aggregate by" >}}

### Tenant database instance name and number for SAP HANA® data source

<!-- Miguel Palau -->

_Generally available in Grafana Open Source and Enterprise_

The SAP HANA® data source now supports tenant databases connections by using the database name and/or instance number. For more information, refer to [SAP HANA® configuration](/docs/plugins/grafana-saphana-datasource/latest/#configuration).

{{< video-embed src="/media/docs/sap-hana/tenant.mp4" >}}

### Log aggregation for Datadog data source

<!-- Taewoo Kim -->

_Generally available in Grafana Open Source and Enterprise_

The Datadog data source now supports log aggregation. This feature helps aggregate logs/events into buckets and compute metrics and time series. For more information, refer to [Datadog log aggregation](/docs/plugins/grafana-datadog-datasource/latest#logs-analytics--aggregation).

{{< video-embed src="/media/docs/datadog/datadog-log-aggregation.mp4" >}}

### API throttling for Datadog data source

<!-- Taewoo Kim -->

_Generally available in Grafana Open Source and Enterprise_

The Datadog data source supports blocking API requests based on upstream rate limits (for metric queries). With this update, you can set a rate limit percentage at which the plugin stops sending queries.

To learn more, refer to [Datadog data source settings](/docs/plugins/grafana-datadog-datasource/latest#configure-the-data-source), as well as the following video demo.

{{< video-embed src="/media/docs/datadog/datadog-rate-limit.mp4" >}}

### Query-type template variables for Tempo data source

<!-- Fabrizio Casati -->

_Generally available in Grafana Open Source and Enterprise_

The Tempo data source now supports query-type template variables. With this update, you can create variables for which the values are a list of attribute names or attribute values seen on spans received by Tempo.

To learn more, refer to the following video demo, as well as the [Grafana Variables documentation](/docs/grafana/next/dashboards/variables/).

{{< video-embed src="/media/docs/tempo/screen-recording-grafana-10.2-tempo-query-type-template-variables.mp4" >}}

## Explore

### Content outline

<!-- Thanos Karachalios -->

_Generally Available in Grafana Open Source and Enterprise_

Introducing Content Outline in Grafana **Explore**. We recognized that complex mixed queries, as well as lengthy logs and traces results led to to time-consuming navigation and the loss of context. Content outline is our first step towards seamless navigation from log lines to traces and back to queries ensuring quicker searches while preserving context. Experience efficient, contextual investigations with this update in Grafana Explore. To learn more, refer to the [Content outline documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/#content-outline), as well as the following video demo.

{{< video-embed src="/media/docs/grafana/explore/content-outline-demo.mp4" >}}

## Transformations

As our work on improving the user experience of transforming data continues, we've also been adding new capabilities to transformations.

### Support for dashboard variables in transformations

<!-- Oscar Kilhed, Victor Marin -->

_Experimental in Grafana Open Source and Enterprise_

Previously, the only transformation that supported [dashboard variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) was the **Add field from calculation** transformation. We've now extended the support for variables to the **Filter by value**, **Create heatmap**, **Histogram**, **Sort by**, **Limit**, **Filter by name**, and **Join by field** transformations. We've also made it easier to find the correct dashboard variable by displaying available variables in the fields that support them, either in the drop-down or as a suggestion when you type **$** or press Ctrl + Space:

{{< figure src="/media/docs/grafana/transformations/completion.png" caption="Input with dashboard variable suggestions" >}}

### New modes for the Add field from calculation transformation

<!-- Victor Marin -->

_Generally available in Grafana Open Source and Enterprise_

The **Add field from calculation** transformation has a couple updates.

**Unary operations** is a new mode that lets you apply mathematical operations to a field. The currently supported operations are:

- **Absolute value (abs)** - Returns the absolute value of a given expression. It represents its distance from zero as a positive number.
- **Natural exponential (exp)** - Returns _e_ raised to the power of a given expression.
- **Natural logarithm (ln)** - Returns the natural logarithm of a given expression.
- **Floor (floor)** - Returns the largest integer less than or equal to a given expression.
- **Ceiling (ceil)** - Returns the smallest integer greater than or equal to a given expression.

{{< figure src="/media/docs/grafana/transformations/unary-operation.png" >}}

**Row index** can now show the index as a percentage.

Learn more in the [Add field from calculation documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation).

### New transformation: Format string

<!-- Solomon Dubock, BI Squad -->

_Experimental in Grafana Open Source and Enterprise_

With the new **Format string** transformation, you can manipulate string fields to improve how they're displayed. The currently supported operations are:

- **Change case** changes the case of your string to upper case, lower case, sentence case, title case, pascal case, camel case, or snake case.
- **Trim** removes white space characters at the start and end of your string.
- **Substring** selects a part of your string field.

Learn more in the [Format string documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#format-string).

## Correlations

### Correlations editor in Explore

<!-- Kristina Durivage -->

_Available in public preview in Grafana Open Source and Enterprise_

Creating correlations has just become easier. Try out our new correlations editor in **Explore** by selecting the **+ Add > Add correlation** option from the top bar or from the command palette. The editor shows all possible places where you can place data links and guides you through building and testing target queries. For more information, refer to [the documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/correlations/).

To try out **Correlations**, enable the `correlations` feature toggle.

### Create correlations for provisioned data sources

<!-- Piotr Jamróz -->

_Available in public preview in Grafana Open Source and Enterprise_

You can now create correlations using either the **Administration** page or provisioning, regardless of whether a data source was provisioned or not. In previous versions of Grafana, if a data source was provisioned, the only way to add correlations to it was also with provisioning. Now, that's no longer the case, and you can easily create new correlations mixing both methods—using the **Administration** page or provisioning.

To try out **Correlations**, enable the `correlations` feature toggle.

## TraceQL query editor

### Improved TraceQL query editor

<!-- Fabrizio Casati -->

_Generally available in Grafana Open Source and Enterprise_

The [TraceQL query editor](https://grafana.com/docs/tempo/latest/traceql/#traceql-query-editor) has been improved to facilitate the creation of TraceQL queries. In particular, it now features improved autocompletion, syntax highlighting, and error reporting.

{{< video-embed src="/media/docs/tempo/screen-recording-grafana-10.2-traceql-query-editor-improvements.mp4" >}}

### Multiple spansets per trace

<!-- Joey Tawadrous -->

_Generally available in Grafana Open Source and Enterprise_

The [TraceQL query editor](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/#traceql-query-editor) has been improved to facilitate the grouping of multiple spans per trace in TraceQL queries. For example, when the following `by(resource.service.name)` is added to your TraceQL query, it will group the spans in each trace by `resource.service.name`.

{{< figure src="/media/docs/tempo/multiple-spansets-per-trace-10-2.png" max-width="750px" caption="Multiple spansets per trace" >}}

## Alerting

### Additional contact points for External Alertmanager

<!-- Alexander Weaver -->

_Generally available in Grafana Open Source and Enterprise_

We've added support for the Microsoft Teams contact points when using an external Alertmanager.

### Grafana OnCall integration for Alerting

<!-- Brenda Muir -->

_Generally available in Grafana Open Source and Enterprise_

Use the Grafana Alerting - Grafana OnCall integration to effortlessly connect alerts generated by Grafana Alerting with Grafana OnCall. From there, you can route them according to defined escalation chains and schedules.

To learn more, refer to the [Grafana OnCall integration for Alerting documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/manage-contact-points/configure-oncall/).

## Authentication and authorization

### Configure refresh token handling separately for OAuth providers

<!-- Mihaly Gyongyosi -->

_Available in public preview in Grafana Open Source and Enterprise_

With Grafana v9.3, we introduced a feature toggle called `accessTokenExpirationCheck`. It improves the security of Grafana by checking the expiration of the access token and automatically refreshing the expired access token when a user is logged in using one of the OAuth providers.

With the current release, we've introduced a new configuration option for each OAuth provider called `use_refresh_token` that allows you to configure whether the particular OAuth integration should use refresh tokens to automatically refresh access tokens when they expire. In addition, to further improve security and provide secure defaults, `use_refresh_token` is enabled by default for providers that support either refreshing tokens automatically or client-controlled fetching of refresh tokens. It's enabled by default for the following OAuth providers: `AzureAD`, `GitLab`, `Google`.

For more information on how to set up refresh token handling, please refer to [the documentation of the particular OAuth provider.](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/).

{{% admonition type="note" %}}
The `use_refresh_token` configuration must be used in conjunction with the `accessTokenExpirationCheck` feature toggle. If you disable the `accessTokenExpirationCheck` feature toggle, Grafana won't check the expiration of the access token and won't automatically refresh the expired access token, even if the `use_refresh_token` configuration is set to `true`.

The `accessTokenExpirationCheck` feature toggle will be removed in Grafana v10.3.
{{% /admonition %}}

### Add dashboard and folder permissions to service accounts

<!-- Jo Guerreiro -->

_Generally available in Grafana Open Source and Enterprise_

Service accounts allow you to create a token that can be used to authenticate with Grafana.
You can use this token to access Grafana's API, as well as dashboards that the service account has access to.

In this release, we've added the ability to assign dashboard and folder permissions to service accounts.
This means that you can now create a service account that can be used to access a specific dashboard and nothing else.

This is useful if you want to limit the access service accounts have to your Grafana instance.

### Add data source permissions to service accounts

<!-- Jo Guerreiro -->

_Available in Grafana Enterprise_

Service accounts are a powerful tool for authenticating with Grafana's API and accessing data sources.
However, without proper access controls, service accounts can pose a security risk to your Grafana instance.

To address this issue, Grafana 10.2 introduces the ability to assign data source permissions to service accounts.
With this feature, you can create a service account that has access to a specific data source and nothing else.
This is useful in scenarios where you want to limit the access service accounts have to your Grafana instance.

For example, imagine you have a team of developers who need to access a specific data source to develop a new feature.
Instead of giving them full access to your Grafana instance, you can create a service account that has access only to that data source.
This way, you can limit the potential damage that could be caused by a compromised service account.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-2-sa-managed-permissions.png" caption="Data source permissions in 10.2" >}}

### Role mapping support for Google OIDC

<!-- Jo Guerreiro -->

_Generally available in Grafana Open Source and Enterprise_

You can now map Google groups to Grafana organizational roles when using Google OIDC.
This is useful if you want to limit the access users have to your Grafana instance.

We've also added support for controlling allowed groups when using Google OIDC.

Refer to the [Google Authentication documentation](http://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/google/) to learn how to use these new options.

### Permission validation on custom role creation and update

<!-- Mihaly Gyongyosi -->

_Generally available in Grafana Enterprise_

With the current release, we enabled RBAC permission validation (`rbac.permission_validation_enabled` setting) by default. This means that the permissions provided in the request during custom role creation or update are validated against the list of [available permissions and their scopes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/#action-definitions). If the request contains a permission that is not available or the scope of the permission is not valid, the request is rejected with an error message.

### No basic role

<!-- Eric Leijonmarck -->

_Generally available in Grafana Open Source and Enterprise_

We're excited to introduce the "No basic role," a new basic role with no permissions. A basic role in Grafana dictates the set of actions a user or entity can perform, known as permissions. This new role is especially beneficial if you're aiming for tailored, customized RBAC permissions for your service accounts or users. You can set this as a basic role through the API or UI.

Previously, permissions were granted based on predefined sets of capabilities. Now, with the "No basic role," you have the flexibility to be even more granular.

For more details on basic roles and permissions, refer to the [documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).
