---
aliases:
  - /docs/grafana/latest/reference/previews/
keywords:
  - grafana
  - dashboard
  - documentation
  - previews
title: Dashboard previews
weight: 9
---

# Dashboard previews

{{< video-embed src="/static/img/docs/dashboards/previews.webm" max-width="950px" >}}

Dashboard previews provide an overview of all available dashboards. They help you quickly find the right dashboard when the dashboard names aren't enough on their own.

> **Note:** Dashboard previews are available in Grafana 9.0+ as an opt-in beta feature. Data source permissions are not yet taken into the account when displaying the dashboard previews - refer to the [permissions]({{< relref "#preview-visibility">}}) to learn more before enabling the feature.

You can view dashboard previews only when the feature is enabled for your instance. It is an opt-in feature that is, by default, disabled. You can view the previews in the Grafana UI after clicking on the _Show previews_ toggle once the administrator enables the feature following the procedure described below.

- [Enable dashboard previews](#enable-dashboard-previews)
- [About the dashboard previews crawler](#about-the-dashboard-previews-crawler)
- [Permissions](#permissions)

## Enable dashboard previews

1. Install the Image Renderer plugin or set up a remote rendering service. The minimum version of Image Renderer required for the dashboard preview feature `3.4.0`. Refer to [Image rendering]({{< relref "../image-rendering/" >}}) for more information.
2. Modify the [configuration file]({{< relref "../administration/configuration.md#configuration-file-location" >}}) to enable the `dashboardPreviews` [feature toggle]({{< relref "../administration/configuration.md#feature_toggles" >}}).

```
[feature_toggles]
# enable features, separated by spaces
enable = dashboardPreviews
```

3. Save your changes. Grafana should reload automatically; we recommend restarting the Grafana server in case of any issues.

Verify that your setup was successful in the dashboard search page. You should see dashboard preview placeholders for all your existing dashboards after clicking on the _Show previews_ toggle at the top of the page.

{{< video-embed src="/static/img/docs/dashboards/previews-successful-setup.webm" max-width="950px" >}}

The first crawler run should begin approximately five minutes after restarting the Grafana instance.

In case you see any warnings after clicking on the toggle, check [Grafana server logs]({{< relref "../administration/configuration.md#log" >}}) for more context. The logger used by the Previews Service is named `previews_service`.

{{< figure src="/static/img/docs/dashboards/previews-unsuccessful-setup.png" max-width="950px" >}}

## About the dashboard previews crawler

The dashboard previews crawler is a background process that:

- [Prepares a list of dashboards to visit](#preparing-the-dashboard-list)
- [Visits and takes a screenshot of each dashboard](#rendering-previews)
- [Saves the screenshots in persistent storage](#saving-previews)

The crawler can be configured via the main config file. Check the [dashboard previews section]({{< relref "../administration/configuration.md#dashboard_previews" >}}) for more details.

### Preparing the dashboard list

During the initial crawler run, the list contains all dashboards across all organizations.
During subsequent runs, the list will have fewer elements. It will only contain dashboards that:

- are new
- have changed since taking their last preview
- haven't changed, but the crawler failed to take their preview during the initial run

Modifying a dashboard is the only way of refreshing that dashboard's preview; previews do not have a set timeout after which they expire.

### Rendering previews

The crawler sends a render request to the Image Renderer for each dashboard in the list. The renderer is then instructed to open the dashboard in kiosk mode, take a screenshot, and scale it down to a small, 320 x 240px thumbnail. The following dashboard in Grafana Play is an example of kiosk mode: https://play.grafana.org/playlists/play/1?kiosk.

Multiple render requests are issued concurrently to improve performance. The maximum number of concurrent requests can be configured via the `dashboard_previews.crawler.thread_count` config option.
Use the new [contextPerRenderKey]({{< relref "../image-rendering/#rendering-mode" >}}) clustering mode in Image Renderer to further optimize crawler's resource usage.

### Saving previews

The crawler saves previews and their metadata in Grafana's DB. Preview's metadata contains, among other things, the [dashboard version]({{< relref "dashboard-history/" >}}) from the time of taking the screenshot. During subsequent runs, the crawler uses the saved version to find stale dashboard previews.

## Permissions

### Crawler permissions

The crawler is set up with the required permissions to display all dashboards and query all data sources. The way the permissions are set up depends on the version of Grafana.

In OSS and Enterprise Grafana instances without RBAC enabled, the crawler uses a special user with an `Admin` role.
In an Enterprise Grafana instance with RBAC enabled, the crawler uses [service accounts]({{< relref "../administration/service-accounts/" >}}) with three fixed roles:

- `fixed:dashboards:reader`
- `fixed:datasources:reader`
- `fixed:folders:reader`

{{< figure src="/static/img/docs/dashboards/previews-service-account.png" max-width="950px" >}}

Service accounts are created per organization. They are visible in the service account configuration tab, and use the following naming convention: `dashboard-previews-crawler-{organization_id}`.

### Preview visibility

Currently, users can see the previews of all dashboards they have access to. Data source permissions are not yet taken into account - users can see previews of dashboards with data sources they can't see or query.

Data source permission check work is still ongoing - we will add it before moving the feature out of beta and announcing general availability.
