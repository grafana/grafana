+++
title = "What's New in Grafana v6.7"
description = "Feature and improvement highlights for Grafana v6.7"
keywords = ["grafana", "new", "documentation", "6.7", "release notes"]
type = "docs"
[menu.docs]
name = "Version 6.7"
identifier = "v6.7"
parent = "whatsnew"
weight = -16
+++

# What's new in Grafana v6.7

This topic includes the release notes for the Grafana v6.7, which is currently in beta. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

Grafana 6.7 comes with a lot of new features and enhancements:

- [**Dashboard:** Enforce minimum refresh interval]({{< relref "#enforce-minimum-dashboard-refresh-interval" >}})
- **Data source:** Google Sheets data source 
- [**Explore:** Query history]({{< relref "#query-history" >}})
- [**Authorization:** Azure OAuth]({{< relref "#azure-oauth" >}})
- [**Stackdriver:** Project Selector]({{< relref "#project-selector" >}})
- [**Enterprise:** White Labeling for application title]({{< relref "#white-labeling-for-application-title" >}})
- [**Enterprise:** Reporting configuration for timeout and concurrency]({{< relref "#reporting-configuration-for-timeout-and-concurrency" >}})
- [**Enterprise:** Export dashboard as pdf]({{< relref "#export-dashboard-as-pdf" >}})
- [**Enterprise:** Report landscape mode]({{< relref "#report-landscape-mode" >}})
- [**Enterprise:** Azure OAuth Team Sync support]({{< relref "#azure-oauth-team-sync-support" >}})

## General features

General features are included in all Grafana editions.

### Query history
> BETA: Query history is a beta feature. It is local to your browser and is not shared with others.

Query history is a new feature that lets you view and interact with the queries that you have previously run in Explore. You can add queries to the Explore query editor,  write comments, create and share URL links, star your favorite queries, and much more. Starred queries are displayed in Starred tab, so it is easier to reuse queries that you run often without typing them from scratch.

Learn more about query history in [Explore]({{< relref "../features/explore" >}}).

{{< docs-imagebox img="/img/docs/v67/rich-history.gif" max-width="1024px" caption="Query history" >}}

### Azure OAuth
Grafana v6.7 comes with a new OAuth integration for Microsoft Azure Active Directory. You can now assign users and groups to Grafana roles from the Azure Portal. Learn how to enable and configure it in [Azure AD OAuth2 authentication]({{< relref "../auth/azuread/" >}}).

### Enforce minimum dashboard refresh interval

Allowing a low dashboard refresh interval can cause severe load on data sources and Grafana. Grafana v6.7 allows you to restrict the dashboard refresh interval so it cannot be set lower than a given interval. This provides a way for administrators to control dashboard refresh behavior on a global level.

Refer to min_refresh_interval in [Configuration]({{< relref "../administration/configuration/#min-refresh-interval" >}}) for more information and how to enable this feature.

### Stackdriver project selector

A Stackdriver data source in Grafana is configured for one service account only. That service account is always associated with a default project in Google Cloud Platform (GCP). Depending on your setup in GCP, the service account might be granted access to more projects than just the default project. 

In Grafana 6.7, the query editor has been enhanced with a project selector that makes it possible to query different projects without changing datasource. Many thanks [Eraac](https://github.com/Eraac), [eliaslaouiti](https://github.com/eliaslaouiti), and [NaurisSadovskis](https://github.com/NaurisSadovskis) for making this happen! 

## Grafana Enterprise features

General features are included in the Grafana Enterprise edition software.

### White labeling customizes application title
This release adds a new white labeling option to customize the application title. Learn how to configure it in [White labeling]({{< relref "../enterprise/white-labeling/" >}}).

```
[white_labeling]
# Set to your company name to override application title
app_title = Your Company
```

### Configure reporting for timeout and concurrency

This release adds more configuration for the reporting feature rendering requests. You can set the panel rendering request timeout and the maximum number of concurrent calls to the rendering service in your configuration. Learn how to do it in [Reporting]({{< relref "../enterprise/reporting/" >}}).

```
[reporting]
# Set timeout for each panel rendering request
rendering_timeout = 10s
# Set maximum number of concurrent calls to the rendering service
concurrent_render_limit = 10
```

### Export dashboard as PDF

This feature allows you to export a dashboard as a PDF document. All dashboard panels will be rendered as images and added into the PDF document. Learn more in [Export dashboard as PDF]({{< relref "../enterprise/export-pdf/" >}}).

### Report landscape mode

You can now use either portrait or landscape mode in your reports. Portrait will render three panels per page and landscape two.
{{< docs-imagebox img="/img/docs/enterprise/reports_create_new.png" max-width="1024px" caption="New report" >}}

[Reporting]({{< relref "../enterprise/reporting/" >}}) has been updated as a result of this change.

### Azure OAuth Team Sync support
When setting up OAuth with Microsoft Azure AD, you can now sync Azure groups with Teams in Grafana.
Learn more in [Team sync]({{< relref "../enterprise/team-sync/" >}}).
