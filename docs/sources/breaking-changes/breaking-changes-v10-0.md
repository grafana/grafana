---
description: Learn about breaking changes in Grafana v10.0
keywords:
  - grafana
  - breaking changes
  - documentation
  - '10.0'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Breaking changes in Grafana v10.0
weight: -1
---

# Breaking changes in Grafana v10.0

Following are breaking changes that you should be aware of when upgrading to Grafana v10.0.

For our purposes, a breaking change is any change that requires users or operators to do something. This includes:

- Changes in one part of the system that could cause other components to fail
- Deprecations or removal of a feature
- Changes to an API that could break automation
- Changes that affect some plugins or functions of Grafana
- Migrations that can’t be rolled back

For each change, the provided information:

- Helps you determine if you’re affected
- Describes the change or relevant background information
- Guides you in how to mitigate for the change or migrate
- Provides more learning resources

For release highlights and deprecations, refer to our [v10.0 What’s new](../../whatsnew/whats-new-in-v10-0/). For the specific steps we recommend when you upgrade to v10.0, check out our [Upgrade guide](../../upgrade-guide/upgrade-v10.0/).

<!--
## Feature

You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).-->

## General breaking changes

### Angular is deprecated and turned off by default for new Grafana Cloud stacks

#### You are affected if:

You create a new Grafana Cloud stack and intend to use any panel or data source plugins written using the Angular.js JavaScript framework. See the [list of Angular plugins](../../developers/angular_deprecation/angular-plugins/).

#### Background

AngularJS is an old frontend framework that stopped active development many years ago. Because of that, it's a security risk. AngularJS also requires **unsafe-eval** in the [CSP (Content Security Policy)](https://developer.mozilla.org/en/Security/CSP) settings, which also reduces the security level of how javascript is executed in the browser.

Angular plugin support in Grafana is deprecated, meaning it will be removed in a future release. There are still some community and private plugins built using Angular. Starting with v9.0, Grafana has a server configuration option, called [angular_support_enabled](../../setup-grafana/configure-grafana/#angular_support_enabled), that controls whether Angular plugin support is available.

#### Change in Grafana v10

Angular is disabled by default for all new Grafana Cloud stacks. Existing stacks in Grafana Cloud, Grafana Enterprise on-premise instances, and Grafana OSS instances will not be automatically impacted.

#### How to mitigate

If you're using Angular plugins in Grafana, try an alternative panel or data source that doesn't use Angular. This list of detected [Angular plugins](../../developers/angular_deprecation/angular-plugins/) offers alternatives where they exist.

If you're a developer maintaining a plugin that uses Angular, we recommend you refactor or rewrite its frontend using React.js instead. The team at Grafana is ready to help and provide tools and guidance; you can reach us in [Slack](https://grafana.slack.com/archives/C3HJV5PNE) or on our [Forum](https://community.grafana.com/c/plugin-development/30).

#### Learn more

- [Angular Support Deprecation documentation](../../developers/angular_deprecation/)

### Grafana legacy alerting is deprecated and no longer accepts internal or external contributions

#### You are affected if:

You use Grafana legacy alerting and have requested new features or changes to it.

#### Description

Grafana legacy alerting (dashboard alerts) has been deprecated since Grafana v9.0, in favor of the new, improved Grafana Alerting. In Grafana v10, the legacy alerting codebase&mdash;which depends on Angular&mdash;is still available, but we'll no longer contribute to it or accept external contributions for it. We'll continue to work on the migration path from legacy alerting to Grafana Alerting for our remaining users that need to migrate.

#### Migration path

The new Grafana Alerting was introduced in Grafana 8 and is a superset of legacy alerting. Learn how to migrate your alerts in the [Upgrade Alerting documentation](https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts/).

### API keys are migrating to service accounts

#### You are affected if:

You use Grafana API keys and haven't yet migrated to service accounts

#### Description

In Grafana v8.5, we introduced [service accounts](https://grafana.com/blog/2022/08/24/new-in-grafana-9.1-service-accounts-are-now-ga/), which are a superset of API keys that support token rotation and role-based access control (RBAC). They were promoted to general availability (GA) in v9.1, with an option to manually migrate API keys to service accounts through the UI and API since then. **When you upgrade to Grafana v10, Grafana will automatically migrate all API keys to service accounts and hide the API keys screen that was under the Admin section.**

This is a "breaking" change because if users are used to seeing and interacting with API keys, they won't see that page in navigation anymore and will need to navigate to the **Service accounts** page instead. However, your existing API tokens will remain fully functional and migrated to service accounts, so no automation will break. If you roll back to a previous version of Grafana, your API keys will remain intact.

Grafana's [HTTP API endpoints for generating and managing API Keys](../../developers/http_api/auth/#create-api-token) remain functional, but we recommend you begin using the [Service account HTTP API](../../developers/http_api/serviceaccount/) to generate and manage machine authentication instead.

#### Migration path

While upgrading to Grafana v10, you don't need to take any action; your API keys will be automatically migrated. To test or perform the migration from API keys to service accounts before upgrading to Grafana v10, follow our [migration documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/migrate-api-keys/).

#### Learn more

- [Documentation on migrating from API keys to service accounts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/service-accounts/migrate-api-keys/)

- [Blog post announcement with a video demo including how to migrate](https://grafana.com/blog/2022/08/24/new-in-grafana-9.1-service-accounts-are-now-ga/)

### The experimental "dashboard previews" feature is removed

#### You are affected if:

You have the `dashboardPreviews` feature toggle switched on.

#### Description

We're removing the experimental dashboard previews feature due to user permission and performance issues that prevented us from continuing its development. Dashboard previews have been behind a feature toggle since Grafana v9.0.

#### Migration path

The entire feature has been removed from Grafana. For users who enabled the `dashboardPreviews` feature flag, Grafana will continue to work as-is but without dashboard previews. We recommend you remove the `dashboardPreviews` feature flag from your Grafana configuration.

#### Learn more

- [Previous dashboard previews documentation](https://grafana.com/docs/grafana/v9.5/search/dashboard-previews/)

### RBAC is on by default in Grafana Enterprise and cannot be disabled

#### You are affected if:

You have actively disabled RBAC in Grafana's configuration.

#### Description

Starting from Grafana 9, RBAC has been enabled by default. An option to disable RBAC was introduced as an emergency mechanism and has only been used in rare cases. With Grafana v10 we removed the configuration option to disable RBAC. This ensures that Grafana works consistently across different features and decreases the risk of having issues with Grafana's legacy access control. Additionally, access control for some of the Grafana v10 features only work with the RBAC, so disabling it is no longer an option.

#### Migration path

No action is needed&mdash;migration is automatic. Users' current roles, permissions, SSO mapping, and other authorization functionality will continue to work as before.

### Usernames are now case-insensitive by default

#### You are affected if:

You run Grafana with a Postgres or sqlite database, you import users from different SSO identity providers (like Google and Active Directory), and users who signed in from different providers were previously created twice because of case differences (for example "<Myra@Grafana.com>" vs "<myra@grafana.com>."

#### Background

When someone signs up for a Grafana account, they can do it using an email or a login. The fields were case sensitive, which could lead to two or more accounts being created for the same user. Additionally, Grafana allows users to set up an authentication provider, and that provider might return an individual's sign-up email with an uppercased domain name or some combination of uppercase and lowercase letters.

Having several accounts leads to split user permissions, confusion among signup flows, and unused "zombie" accounts in your database. Plus, multiple accounts can introduce issues when switching between authentication providers. We refer to these inconsistencies in user uniqueness as a _user identity conflict_.

#### Change in Grafana v10

Grafana will start matching users without regard for case. Conflicting users will not be able to sign in.

#### Migration path

We've built a [CLI tool](https://grafana.com/blog/2022/12/12/guide-to-using-the-new-grafana-cli-user-identity-conflict-tool-in-grafana-9.3/) which users can use to resolve any potential conflicts beforehand. This breaking change was communicated already with Grafana v9.3.

#### Learn more

- [Blog post describing usage of the new CLI command](https://grafana.com/blog/2022/12/12/guide-to-using-the-new-grafana-cli-user-identity-conflict-tool-in-grafana-9.3/)

### Grafana OAuth integrations do not work anymore with email lookups

#### You are affected if:

- You have configured Grafana to use multiple identity providers, and you have users with the same email address in multiple identity providers.
- You have configured Grafana to use Generic OAuth with an identity provider that does not support a unique ID field.

#### Background

Grafana used to validate identity provider accounts based on the email claim. On many identity providers, the email field is not unique, and this could open a possible account vector to perform an account takeover and authentication bypass in certain scenarios.
This change also ensures that Grafana is protected against the [CVE-2023-3128](https://grafana.com/security/security-advisories/cve-2023-3128/) vulnerability.

#### Change in Grafana v10

Grafana will not allow the affected users to sign in.

#### Migration path

In order to address any errors, we have provided an escape hatch that allows you to activate email lookup. You can use the following configuration in your Grafana instance to return the previous behavior.

```
[auth]
oauth_allow_insecure_email_lookup = true
```

We strongly recommend not doing this in case you are using Azure AD as an identity provider with a multi-tenant app.

#### Learn more

- [CVE-2023-3128 Advisory](https://grafana.com/security/security-advisories/cve-2023-3128//)
- [Enable email lookup](../../setup-grafana/configure-security/configure-authentication/)

### The "Alias" field in the CloudWatch data source is removed

#### You are affected if:

You're using the "Alias" field in the CloudWatch data source, instead of using dynamic labels.

#### Description

Alias patterns in the CloudWatch query editor were replaced by Label (dynamic labels) behind a feature toggle. Starting from Grafana v9, Label has been enabled by default. With Grafana v10 we removed the option to disable Label and remove the Alias field entirely.

#### Migration path

Open and save each dashboard that uses the Alias field. Alias is migrated to Label automatically when you load the dashboard.

#### Learn more

- [Grafana CloudWatch documentation about the change](../../datasources/aws-cloudwatch/query-editor/#label)

### Athena data source plugin must be updated to version >=2.9.3

#### You are affected if:

You've installed and are using the Athena data source plugin.

#### Description

Grafana v10.0.0 ships with the new React 18 upgrade. In turn, changes in the batching of state updates in React 18 cause a bug in the query editor in Athena plugin versions <=2.9.2.

#### Migration path

Update the plugin to version 2.9.3 or higher in your Grafana instance management console. This will ensure your plugin query editor works as intended.

### Redshift data source plugin must be updated to version >=1.8.3

#### You are affected if:

You've installed and are using the Redshift data source plugin.

#### Description

Grafana v10.0.0 ships with the new React 18 upgrade. In turn, changes in the batching of state updates in React 18 cause a bug in the query editor in Redshift plugin versions <=1.8.3.

#### Migration path

Update the plugin to version 1.8.3 or higher in your Grafana instance management console. This will ensure your plugin query editor works as intended.

### DoiT International BigQuery plugin no longer supported

#### You are affected if:

You've installed and are using the [DoiT International BigQuery data source plugin](https://github.com/doitintl/bigquery-grafana).

#### Description

In v10.0.0, Grafana no longer supports the use of the [DoiT International BigQuery data source plugin](https://github.com/doitintl/bigquery-grafana), which was moved to a "retired" state in the latter half of 2022, and for which the GitHub repository was archived in December 2022. For BigQuery data sources to continue functioning, you're required to migrate to the [Official Grafana BigQuery data source plugin](https://github.com/grafana/google-bigquery-datasource/).

#### Migration path

For everyone using Grafana v8.5+, it’s possible to import queries created with the DoiT International BigQuery community plugin by simply changing the data source to Grafana BigQuery in the data source selector in the affected panel. Please note that [queries will be imported](https://github.com/grafana/google-bigquery-datasource#importing-queries-created-with-doit-international-bigquery-datasource-plugin) as raw SQL queries.

#### Learn more

- [Information about importing DoiT International BigQuery queries](https://github.com/grafana/google-bigquery-datasource#importing-queries-created-with-doit-international-bigquery-datasource-plugin).

## For Plugin Developers

### Upgrading to React 18

#### You are affected if:

You've developed a Grafana plugin that uses the React JS framework (this includes most app, panel, and data source plugins).

#### Description

Grafana has been upgraded to React 18 and now leverages the new React client rendering API. Plugin authors in particular should be aware, as there could be unintended side effects due to the changes around automatic batching of state updates and consistent `useEffect` timings.

#### Migration path

As a plugin developer: once a canary build has been released (post-9.5.0), test your plugin against one of the grafana-dev docker builds [here](https://hub.docker.com/r/grafana/grafana-dev/tags?page=1) ([this one](https://hub.docker.com/layers/grafana/grafana-dev/10.0.0-111404pre/images/sha256-ac78acf54b44bd2ce7e68b796b1df47030da7f35e53b02bc3eec3f4de05f780f?context=explore) for example). Because of the extra optimisations made by React 18, some changes may be needed to maintain previous behavior.

#### Learn more

- [React 18 release notes](https://react.dev/blog/2022/03/29/react-v18)

- [React 18 upgrade guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)

### Deprecated logs-related functions and variables have been removed from the "@grafana/data" and "@grafana/ui" packages

#### You are affected if:

You're a plugin author and you use one of the following logs-related functions:

- The interface type LogsParser in grafana-data

- The following functions and classes related to logs in the grafana-ui package: `1LogLabels`, `LogMessageAnsi`, `LogRows`, `getLogRowStyles.`, `getLogLevel`, `getLogLevelFromKey`, `addLogLevelToSeries`, `LogsParsers`, `calculateFieldStats`, `calculateLogsLabelStats`, `calculateStats`, `getParser`, `sortInAscendingOrder`, `sortInDescendingOrder`, `sortLogsResult`, `sortLogRows`, `checkLogsError`, `escapeUnescapedString`.

#### Description

Certain rarely-used logs-related functions and variables have been moved from grafana-packages to the core grafana codebase. These items have been marked as deprecated previously, and a deprecation-notice was issued in the grafana changelog. Plugin authors who have relied on these functions and variables being available will have to adjust their codebase.

#### Migration path

If you've written a data source or panel plugin, make sure it doesn't use the functions and variables that have been deprecated and removed.

#### Learn more

- [https://github.com/grafana/grafana/issues/65779](https://github.com/grafana/grafana/issues/65779)

- [https://github.com/grafana/grafana/issues/65778](https://github.com/grafana/grafana/issues/65778)

### DataFrame: Use Array<T> or Vector<T> for field values

<!--check on how the <T> are supposed to show up -->

#### You are affected if:

You're a plugin author and you've implemented your own version of Vector for data frames.

#### Description

Working with DataFrames was more complicated than it should have been because data was held in a Vector interface rather than a simple Array. In Grafana v10, the interface has been changed so developers can use simple arrays or Vectors.

#### Migration path

Any code using Vectors will continue to work without issue. If you've implemented your own version of Vector, it will need to be updated. The easiest approach is to refactor code so it extends MutableVector. This will work in both Grafana v9 and v10.

#### Learn more

- [https://github.com/grafana/grafana/issues/66480](https://github.com/grafana/grafana/issues/66480)

### grafana/toolkit CLI commands have been removed and migrated to the create-plugin package

#### You are affected if:

You develop plugins using @grafana/toolkit CLI commands.

#### Description

We announced the deprecation of the grafana/toolkit in v9.3 (November 2022) and have a new tool called create-plugin now available as a replacement. We encourage you to migrate and use our updated tooling. All grafana/toolkit commands except `build` are removed in Grafana v10.

Here are some of the benefits of create-plugin:

- **More flexible:** With @grafana/create-plugin, you have more control over your plugins and their dependencies, and can more easily customize the tooling to fit your specific needs.

- **Faster development time:** With its out-of-the-box development environment @grafana/create-plugin can significantly reduce development time compared to using @grafana/toolkit.

- **Improved testing capabilities:** Testing plugins with @grafana/create-plugin is much easier with GitHub workflows that automate unit and e2e test runs whenever changes are pushed to GitHub.

- **Better documentation:** The [documentation](https://grafana.com/developers/plugin-tools/) for @grafana/create-plugin is more comprehensive and easier to discover than that of @grafana/toolkit.

#### Migration path

You may already be using the new tooling. If you have an existing plugin previously created using the @grafana/toolkit, you can use the following command to migrate it to the new build tooling:

```

# Run this command from the root of your plugin

cd ./my-plugin

npx @grafana/create-plugin@latest migrate

```

#### Learn more

- [Migration guide](https://grafana.com/developers/plugin-tools/migration-guides/migrate-from-toolkit)

## Deprecations

Changing the folder UID through the API is deprecated. This functionality will be removed in a future release.
