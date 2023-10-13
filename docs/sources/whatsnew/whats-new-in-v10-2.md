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

## Add dashboard and folder permissions to service accounts

<!-- Jo Guerreiro -->

_Generally available in Grafana Open Source and Enterprise_

Service accounts allow you to create a token that can be used to authenticate with Grafana.
You can use this token to access Grafana's API, as well as, dashboards that the service account has access to.

In this release, we've added the ability to assign dashboard and folder permissions to service accounts.
This means that you can now create a service account that can be used to access a specific dashboard and nothing else.

This is useful if you want to limit the access service accounts have to your Grafana instance.

## Add data source permissions to service accounts

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

{{< figure src="/media/docs/grafana/screenshot-grafana-10-2-sa-managed-permissions.png" caption="Data source permissions in 10.2" > }}

## Role mapping support for Google OIDC

<!-- Jo Guerreiro -->

_Generally available in Grafana Open Source and Enterprise_

You can now map Google groups to Grafana organizational roles when using Google OIDC.
This is useful if you want to limit the access users have to your Grafana instance.

We've also added support for controlling allowed groups when using Google OIDC.

Refer to the [Google Authentication documentation](http://grafana.com/docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-security/configure-authentication/google/index.md) to learn how to use these new options.

### Permission validation on custom role creation and update

<!-- Mihaly Gyongyosi -->

_Generally available in Grafana Enterprise_

With the current release, we enabled RBAC permission validation (`rbac.permission_validation_enabled` setting) by default. This means that the permissions provided in the request during custom role creation or update are validated against the list of [available permissions and their scopes](https://grafana.com/docs/grafana/<GRAFANA VERSION>/administration/roles-and-permissions/access-control/custom-role-actions-scopes/#action-definitions). If the request contains a permission that is not available or the scope of the permission is not valid, the request is rejected with an error message.
