---
description: Feature and improvement highlights for Grafana v10.0
keywords:
  - grafana
  - new
  - documentation
  - '10.0'
  - release notes
title: What's new in Grafana v10.0
weight: -33
---

# What’s new in Grafana v10.0

Welcome to Grafana 10.0! Read on to learn about changes to search and navigation, dashboards and visualizations, and authentication and security. For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

<!-- Template below
## Feature
[Generally available | Available in experimental/beta] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
> **Note:** You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).-->

## Nested folders

_Available in preview in all editions of Grafana._

You can now create nested folders in Grafana to help you better organize your dashboards and alerts. This new feature allows you to create, read, update, and delete nested folders, making it easier to sort resources by business units, departments, and teams.

You can also set up permissions using Role-Based Access Control (RBAC). Folder permissions will cascade, being inherited from the parent folder, which simplifies access management.

It's worth noting that the nested folders feature is currently in preview. As such, it's recommended to enable it only on test or development instances, rather than in production environments.

To try out the nested folders feature, you'll need to enable the `nestedFolders` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

In subsequent releases, we’ll be refining and enhancing the user interface for managing dashboards and folders, to provide a more streamlined user experience.

{{< figure src="/media/docs/grafana/screenshot-grafana-10.0-nested-folders.png" max-width="750px" caption="Nested folders in Grafana" >}}

## Correlations

_Available in preview in all editions of Grafana._

You can now bring context from multiple data sources into the Explore experience. Correlations is an extension of our existing Data Links functionality and now enables you to link from any data source, to any data source.

Correlations enable you to seamlessly jump from one data source to another. You define relationships between your different data sources, and when Exploring simply click a button next to a related field in one data source and Grafana will run the corresponding query in the other datasource.

It's worth noting that Correlations is currently in preview. As such, it's recommended to enable it only on test or development instances, rather than in production environments.

To try out Correlations, you'll need to enable the `correlations` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

In subsequent releases, we’ll be refining and enhancing the user interface for Correlations, to provide a more streamlined user experience.

## First panel creation flow

_Available in preview in all editions of Grafana._
Concepts like data sources and dashboards panels are hard to grasp and it’s a struggle to go from Grafana’s “empty state” to a working dashboard that displays data.

The new panel creation flow greatly simplifies the data source selection step. It provides a clear overview of your available data sources and a direct link to connecting a new one, the first time you add a panel to your dashboard.

To try it out, you'll need to enable the `datasourceOnboarding` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

## Public dashboards

_Available in preview in all editions of Grafana._
Public dashboards allow you to share your Grafana dashboard with anyone without them having to log into Grafana. This is useful when you want to expose your dashboard to the world.

These are some of the improvements you will find in this version:

<!--
- TODO:Improvements
-->

To try it out, you'll need to enable the `publicDashboards` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

To learn more, check out our public dashboards [documentation](https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/?pg=blog&plcmt=body-txt).

## Scenes

_This is an experiemental library_

Scenes is a new front-end library by Grafana that empowers application engineers to effortlessly build stunning dashboard experiences right into their products. With Scenes, you can easily create apps that mirror the Grafana dashboarding experience, complete with template variable support, flexible layouts, dynamic panel rendering, and so much more.

To try it out, you'll need to enable the `scenes` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

<!--
- TODO: Add link to docs and resources
-->
