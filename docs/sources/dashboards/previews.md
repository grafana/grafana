+++
title = "Dashboard previews"
keywords = ["grafana", "dashboard", "documentation", "previews"]
aliases = ["/docs/grafana/latest/reference/previews/"]
weight = 9
+++

# Previews

{{< figure  max-width="950px" src="/static/img/docs/dashboards/previews.jpg" animated-gif="/static/img/docs/dashboards/previews.gif" >}}

> **Note:** Dashboard previews are available in Grafana 9.0+ as an opt-in beta feature. Please refer to the [permissions]({{< relref "#preview-visibility">}}) section to learn about issues with data source permissions before enabling the feature.

Dashboard previews bring life to all dashboard list pages. Besides looking pretty, they can serve as an overview of all available dashboards, or as a tool to quickly find the right dashboard in case the dashboard names aren't enough on their own.

Grafana users are not forced to use previews. Each user can choose to disable them and go back to the usual look and feel of list views. We save the choice in the browser's local storage to make it persistent across sessions.

- [Enable dashboard previews](#enable-dashboard-previews)
- [About the dashboard previews crawler](#about-the-dashboard-previews-crawler)
- [Permissions](#permissions)

## Enable dashboard previews

1. Install the Image Renderer plugin or set up a remote rendering service. `3.4.0` is the minimum version of Image Renderer required for the dashboard preview feature. Refer to [Image rendering]({{< relref "../image-rendering/" >}}) for more information.
2. Open the [config file]({{< relref "../administration/configuration.md#configuration-file-location" >}}) and enable the `dashboardPreviews` [feature toggle]({{< relref "../administration/configuration.md#feature_toggles" >}}).

```
[feature_toggles]
# enable features, separated by spaces
enable = dashboardPreviews
```

3. Save your changes. Grafana should reload automatically; we recommend restarting the Grafana server in case of any issues.

Visit the dashboard search page to verify that the setup was successful. You should be able to see dashboard preview placeholders for all your existing dashboards after clicking on the _Show previews_ toggle at the top of page.

{{< figure src="/static/img/docs/dashboards/previews-successful-setup.jpg"
max-width="950px" animated-gif="/static/img/docs/dashboards/previews-successful-setup.gif" >}}

Please check [Grafana server logs]({{< relref "../administration/configuration.md#log" >}}) in case you see any warnings after clicking on the toggle - errors logs produced by `dashboard_service` should provide more context.

{{< figure src="/static/img/docs/dashboards/previews-unsuccessful-setup.png" max-width="950px" >}}

## About the dashboard previews crawler

The dashboard previews crawler is a background process that:

1. [Prepares a list of dashboards to visit](#preparing-the-dashboard-list)
2. [Visits and takes a screenshot of each dashboard](#rendering-previews)
3. [Saves the screenshots in persistent storage](#saving-previews)

The crawler can be configured via the main config file:

```ini
[dashboard_previews.crawler]
# Number of dashboards rendered in parallel. Default is 6.
thread_count =

# Timeout passed down to the Image Renderer plugin. It is used in two separate places within a single rendering request:
# First during the initial navigation to the dashboard and then when waiting for all the panels to load. Default is 20s.
# This setting should be expressed as a duration. Examples: 10s (seconds), 1m (minutes).
rendering_timeout =

# Maximum duration of a single crawl. Default is 1h.
# This setting should be expressed as a duration. Examples: 10s (seconds), 1m (minutes).
max_crawl_duration =

# Minimum interval between two subsequent scheduler runs. Default is 12h.
# This setting should be expressed as a duration. Examples: 10s (seconds), 1m (minutes).
scheduler_interval =
```

### Preparing the dashboard list

During the initial crawler run, the list will contain all dashboards across all organizations.
The list will have fewer elements during subsequent runs - it will contain only dashboards which have changed since taking the last preview and those which are brand-new.

Modifying the dashboard is the only way of refreshing that dashboard's preview; previews do not have a set timeout after which they expire.

### Rendering previews

The crawler sends a render request to the Image Renderer for each dashboard in the list. The renderer is instructed to open the dashboard in _kiosk mode_ ([Grafana play example of kiosk mode](https://play.grafana.org/playlists/play/1?kiosk)), take a screenshot, and scale it down to a small, 320 x 240px thumbnail.

Multiple render requests are issued concurrently to improve the performance. The maximum number of concurrent requests can be configured via the `dashboard_previews.crawler.thread_count` config option.
Please consider using the new [contextPerRenderKey]({{< relref "../image-rendering/#rendering-mode" >}}) clustering mode in Image Renderer to further optimize crawler's resource usage.

### Saving previews

The crawler saves previews and their metadata in Grafana's DB. Preview's metadata contains, among other things, the [dashboard version]({{< relref "./dashboard_history" >}}) from the time of taking the screenshot. During subsequent runs, the crawler uses the saved version to find stale dashboard previews.

## Permissions

### Crawler permissions

The crawler is set up with the required permissions to display all dashboards and query all data sources. The way the permissions are set up depends on the version of Grafana.

In OSS and Enterprise Grafana instances without RBAC enabled, the crawler uses a special user with an `Admin` role.
In Enterprise with RBAC enabled, the crawler uses [service accounts]({{< relref "../administration/service-accounts" >}}) with three fixed roles:

- `fixed:dashboards:reader`
- `fixed:datasources:reader`
- `fixed:folders:reader`

{{< figure src="/static/img/docs/dashboards/previews-service-account.png" max-width="950px" >}}

Service accounts are created per organization. They are visible in the service account configuration tab, and their names follow `dashboard-previews-crawler-{organization_id}` convention.

### Preview visibility

Currently, users can see the previews of all dashboards they have access to. Data source permissions are not yet taken into account - users can see previews of dashboards with data sources they can't see or query.

Data source permission check work is still ongoing - we will add it before moving the feature out of beta and announcing general availability.
