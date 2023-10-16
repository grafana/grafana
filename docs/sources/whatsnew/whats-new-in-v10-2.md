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

## Dashboards and visualizations

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

### Generative AI features for dashboards

_Available in public preview in all editions of Grafana_

<!-- Nathan Marrs -->

You can now use generative AI to assist you in your Grafana dashboards. So far generative AI can help you with the following tasks:

- **Generate panel titles and descriptions** - You can now generate a title and description for your panel based on the data you've added to it. This is useful when you want to quickly create a panel and don't want to spend time coming up with a title or description.
- **Generate dashboard titles and descriptions** - You can now generate a title and description for your dashboard based on the panels you've added to it. This is useful when you want to quickly create a dashboard and don't want to spend time coming up with a title or description.
- **Generate dashboard save changes summary** - You can now generate a summary of the changes you've made to a dashboard when you save it. This is useful when you want to quickly save a dashboard and don't want to spend time coming up with a summary.

TODO - how can they use / access these features?? Link to some form of documentation or just say "more info coming soon"?

TODO: Add image / gif / video

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

## Alerting

### Additional contact points for External Alertmanager

<!-- Alexander Weaver -->

_Generally available in Grafana Open Source and Enterprise_

We've added support for the Microsoft Teams contact points when using an external Alertmanager.

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
