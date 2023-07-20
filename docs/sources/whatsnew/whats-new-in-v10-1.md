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

## Authentication and authorization

### Configure refresh token handling separately for OAuth providers

<!-- Mihaly Gyongyosi -->

_Available in public preview in all editions of Grafana._

With Grafana v9.3, we introduced a feature toggle called `accessTokenExpirationCheck`. It improves the security of Grafana by checking the expiration of the access token and automatically refreshing the expired access token when the user is logged in using one of the OAuth providers.

With the current release, we introduce a new configuration option for each OAuth provider called `use_refresh_token` that allows you to configure whether the particular OAuth integration should use refresh tokens to automatically refresh access tokens when they expire. In addition, to further improve security and provide secure defaults, `use_refresh_token` is enabled by default for providers that support either refreshing tokens automatically or client-controlled fetching of refresh tokens. It's enabled by default for the following OAuth providers: `AzureAD`, `GitLab`, `Google`.

For more information on how to set up refresh token handling, please refer to [the documentation of the particular OAuth provider.]({{< relref "../setup-grafana/configure-security/configure-authentication/" >}}).

{{% admonition type="note" %}}
The `use_refresh_token` configuration must be used in conjunction with the `accessTokenExpirationCheck` feature toggle. If you disable the `accessTokenExpirationCheck` feature toggle, Grafana will not check the expiration of the access token and will not automatically refresh the expired access token, even if the `use_refresh_token` configuration is set to `true`.

The `accessTokenExpirationCheck` feature toggle will be removed in Grafana v10.2.
{{% /admonition %}}

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
