---
_build:
  list: false
aliases:
  - /docs/grafana/latest/guides/whats-new-in-v9-3/
description: Feature and improvement highlights for Grafana v9.3
keywords:
  - grafana
  - new
  - documentation
  - '9.3'
  - release notes
title: What's new in Grafana v9.3
weight: -33
---

# What’s new in Grafana v9.3 (Beta)

Welcome to Grafana v9.3. If you’d prefer to dig into the details, check out the complete [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## What's New feature template

Use this template to add your what's new section.

[Generally available | Available in experimental/beta] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]

Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).

Add a screenshot to this enablement material folder and link to it here.

## New navigation

_Available in beta in all editions._

Use Grafana’s redesigned navigation to get full visibility into the health of your systems, by quickly jumping between features as part of your incident response workflow.

As Grafana has grown from a visualization tool to an observability solution, we’ve added many tools along the way. This often resulted in pages that were visually inconsistent or hard to find. This update gives Grafana a new look and feel, and makes page layouts and navigation patterns more consistent.

We’ve revamped the navigation menu and grouped related tools together, making it easier to find what you need. Pages in Grafana now leverage new layouts that include breadcrumbs and a sidebar, allowing you to quickly jump between pages. We’ve also introduced a header that appears on all pages in Grafana, making dashboard search accessible from any page.

Use the `topnav` feature toggle to try out Grafana’s new navigation.

**Note:** The Grafana documentation has not yet been updated to reflect changes to the navigation.

## New languages

_Generally available in all editions._

We have added 4 new languages to Grafana: Spanish, French, German and Simplified Chinese.

With millions of users across the globe, Grafana has a global footprint. In order to make it accessible to a wider audience, we have taken the first steps in localizing key workflows. You can now set Grafana’s language for the navigation, viewing dashboards, and a handful of settings.

Read more about configuring the [default language for your organization](https://grafana.com/docs/grafana/latest/administration/organization-preferences/) and [updating your profile](https://grafana.com/docs/grafana/latest/administration/user-management/user-preferences/).

## Public Dashboards - Audit Table

Available in experimental in Grafana Open Source, Enterprise, Cloud Pro, Cloud Advanced

We have a new feature as part of our Public Dashboard efforts. We have introduced a new menu item under Dashboards → Public Dashboards. This new view is a list of all of the public dashboards in your Grafana instance. From here you can navigate to the underlying dashboard, see if it is enabled, get a quick link out to the public version of the dashboard, or get quick access to the configuration. You will be able to see a dashboard if you have view access, you will be able to navigate to the configuration if you have public dashboard privileges (RBAC “Dashboard Public” or ADMIN basic).

[image public-dashboard-audit-table.png]

## Transformations - Partition by values

Available in experimental in Grafana Open Source, Enterprise, Cloud Pro, Cloud Advanced

This new transformation can help eliminate the need for multiple queries to the same datasource with different WHERE clauses when graphing multiple series. Consider a metrics SQL table with the following data:

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | US     | 1520  |
| 2022-10-20 12:00:00 | EU     | 2936  |
| 2022-10-20 01:00:00 | US     | 1327  |
| 2022-10-20 01:00:00 | EU     | 912   |

Prior to v9.3. if you wanted to plot a red trendline for US and a blue one for EU in the same TimeSeries panel, you would likely have to split this into two queries:

```
   SELECT Time, Value FROM metrics WHERE Time > ‘2022-10-20’ AND Region=’US’
   SELECT Time, Value FROM metrics WHERE Time > ‘2022-10-20’ AND Region=’EU’
```

This also requires you to know ahead of time which regions actually exist in the metrics table.

With the Partition by values transformer, you can now issue a single query and split the results by unique (enum) values from one or more columns (fields) of your choosing. In this case, Region.

```
   SELECT Time, Region, Value FROM metrics WHERE Time > ‘2022-10-20’
```

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | US     | 1520  |
| 2022-10-20 01:00:00 | US     | 1327  |

| Time                | Region | Value |
| ------------------- | ------ | ----- |
| 2022-10-20 12:00:00 | EU     | 2936  |
| 2022-10-20 01:00:00 | EU     | 912   |

## Authentication - OAuth token handling improvements

Generally available in Grafana Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced.

As part of our efforts to improve security of Grafana, we introduce a long-awaited feature which enhances Grafana's OAuth 2.0 compatibility. When a user logs in using an OAuth provider, Grafana on each request verifies that the access token has not expired. When an access token expires, Grafana uses the provided refresh token (if any exists) to obtain a new access token.

This feature is behind the `accessTokenExpirationCheck` feature toggle and it is disabled by default.

Complete documentation on how to configure obtaining a refresh token can be found on the specific Identity Provider's [configuration page]({{< relref "../setup-grafana/configure-security/configure-authentication/" >}}).
