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

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.2, check out our [Upgrade Guide]({{< relref "../upgrade-guide/upgrade-v10.2/index.md" >}}).

<!-- Template below

> Add on-prem only features here. Features documented in the Cloud What's new will be copied from those release notes.

## Feature
<!-- Name of contributor -->
<!-- _[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).
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

For more information on how to set up refresh token handling, please refer to [the documentation of the particular OAuth provider.](https://grafana.com/docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-security/configure-authentication/).

{{% admonition type="note" %}}
The `use_refresh_token` configuration must be used in conjunction with the `accessTokenExpirationCheck` feature toggle. If you disable the `accessTokenExpirationCheck` feature toggle, Grafana won't check the expiration of the access token and won't automatically refresh the expired access token, even if the `use_refresh_token` configuration is set to `true`.

The `accessTokenExpirationCheck` feature toggle will be removed in Grafana v10.3.
{{% /admonition %}}

### Permission validation on custom role creation and update

<!-- Mihaly Gyongyosi -->

_Generally available in Grafana Enterprise_

With the current release, we enabled RBAC permission validation (`rbac.permission_validation_enabled` setting) by default. This means that the permissions provided in the request during custom role creation or update are validated against the list of [available permissions and their scopes](https://grafana.com/docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/#action-definitions). If the request contains a permission that is not available or the scope of the permission is not valid, the request is rejected with an error message.

## Correlations

### Correlations editor in Explore

<!-- Kristina Durivage -->

_Available in public preview in Grafana_

Creating correlations has just become easier. Try out our new correlations editor in Explore by selecting the **+ Add > Add correlation** option from the top bar, or from the command palette. The editor shows all possible places where you can place data links and guides you through building and testing target queries. For more information, refer to [the documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/correlations/).

To try out Correlations, enable the `correlations` feature toggle. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support.

## Create correlations for provisioned data sources

<!-- Piotr Jamróz -->

_Available in public preview in Grafana_

You can now create correlations using either the **Administration** page or provisioning, regardless of whether a data source was provisioned or not. In previous versions of Grafana, if a data source was provisioned, the only way to add correlations to it was also with provisioning. Now, that's no longer the case, and you can easily create new correlations mixing both methods—using the **Administration** page or provisioning.

To try out Correlations, enable the `correlations` feature toggle. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support.
