---
page_title: What's New in Grafana v2.0
page_description: What's new in Grafana v2.0
page_keywords: grafana, new, changes, features, documentation
---

# What's New in Grafana v2.0

Grafana 2.0 represents months of work by the Grafana team and the community. We are pleased to be able to release the Grafana 2.0 beta.

This is a guide that describes some of changes and new features that can be found in Grafana V2.0

If you are interested in how to migrate from Grafana V1.x to V2.0, please read our Migration Guide.

## New backend

Grafana now ships with its own backend server. Dashboards are still 100% client-side rendered, but the integrated server allows for much of the new functionality that 2.0 brings. The backend server is written in Go, has a full API, and is also completely open source. We also provide a CLI tool for accessing API functionality.

In addition to new features, the backend server makes it much easier to set up and enjoy Grafana. 2.0 ships as a single binary with no dependencies, and we hope to extend support to more platforms. Authentication is built in, and Grafana is now capable of proxying connections to Data Sources. There are no longer any CORS (Cross Origin Resource Sharing) issues requiring messy workarounds. Elasticsearch is no longer required just to store dashboards.

## Overhauled User Interface

Grafana has undergone some serious interface changes over the last few months. We have introduced a collapsable side menubar and streamlined the Dashboard top header.

### New dashboard top header
<img class="no-shadow" src="/img/v2/v2_top_nav_annotated.png">

Every Dashboard-related feature can be accessed from the main Dashboard header.

1. `Side menubar toggle` Toggle the side menubar on or off. This allows you to focus on the data presented on the Dashboard. The side menubar provides access to features unrelated to a Dashboard such as Users, Organizations, and Data Sources.
2. `Dashboard dropdown` This main dropdown shows you which Dashboard you are currently viewing, and allows you to easily switch to a new Dashboard. From here you can also create a new Dashboard, Import existing Dashboards, and manage Dashboard playlists. 
3. `Star Dashboard`: Star (or unstar) the current Dashboar. Starred Dashboards will show up on your own Home Dashboard by default, and are a convenient way to mark Dashboards that you're interested in.
4. `Share Dashboard`: Share the current dashboard by creating a link or create a static Snapshot of it. Make sure the Dashboard is saved before sharing.
5. `Save dashboard`: Save the current Dashboard. 
6. `Settings`: Manage Dashboard settings and features such as Templating and Annotations. 

> **Note** In Grafana v2.0 when you change the title of a dashboard and then save it it will no
> longer create a new dashboard. It will just change the name for the current dashboard.
> To change name and create a new dashboard use the `Save As...` menu option

### New Side menubar

The side menubar provides access to features such as User Preferences, Organizations, and Data Sources. If you have multiple Organizations, you can easily switch between them.

## Dashboard Snapshot sharing

A Dashboard Snapshot is an easy way to create and share a URL for a stripped down, point-in-time version of any Dashboard. You can give this URL to anyone or everyone, and they can view the Snapshot even if they're not a User of your Grafana instance. You can set an expiration time for any Snapshots you create.

When you create a Snapshot, we strip sensitive data (like the names of your queries and metrics, information about your Data Sources, etc). The data points displayed on screen for that specific time period in your Dashboard is saved in the JSON of the Snapshot itself. 

Sharing a Snapshot is similar to sharing a link to a screenshot of your dashboard, only way better. Better because they're more like a Dashboard (they'll look great at any screen resolution, you can hover over series, even zoom in). Similar because they're just static files, and aren't actually connected to any live Data Sources in any way.

They allow you to share a specific view of a particular Dashboard, without providing access to the rest of your Grafana instance, simply by sharing the Snapshot URL. They're a great way to communicate about a particular incident with specific people, or over the Internet. You can also use them to show off your dashboards. 

![](/img/v2/dashboard_snapshot_dialog.png)

## Panel time overrides & timeshift

Grafana now allows individual panels to override the time range set in the main time picker. A specific Panel can have a relative time range that will apply only to that Panel. A time shift can be added to specific Panels.

This allows you to build a single Dashboard showing data from different time periods. Utilizing overrides and timeshift, you can build a single Dashboard showing longer term historical alongside more current real time data. You can also also show data from different days for a particular time period.

![](/img/v2/panel_time_override.jpg)

You control these overrides in panel editor mode and the new tab `Time Range`.

![](/img/v2/time_range_tab.jpg)

Currently you can only override the dashboard time with relative time ranges, not absolute time ranges. When
you zoom or change the dashboard time to a custom absolute time range the panel overrides will be disabled. The
panel relative time override is only active when the dashboard time is also relative. The panel timeshift override
however is always active, even when the dashboard time is absolute.

The `Hide time override info` option allows you to hide the the override info text that is by default shown in the
upper right of a panel when overriden time range options.

## New search view & starring dashboards

![](/img/v2/dashboard_search.jpg)

The dashboard search view has received a big update, and received a lot of polish. You can now see and filter Dashboards by name, tag, or by ones your User has starred. The speed of the Dashboard search has also been dramatically improved.

## graph Panel: Logarithmic scale

The graph panel now supports 3 logarithmic scales, `log base 10`, `log base 32`, `log base 1024`. 

Logarithmic y-axis scales are useful when rendering many series of different order of magnitudes on the same Panel. Types of data that can be appropriate for a Logarithmic scale include latency, network traffic, and storage.

![](/img/v2/graph_logbase10_ms.png)

## New Panel: dashlist Panel

![](/img/v2/dashlist_starred.png)

The dashlist is s new panel in Grafana 2.0. It showd your personally starred Dashboards, and provides a Dashboard list based a customizable search of strings and tags.

We plan on creating several new panel types over the coming months.

## Data Source proxy & admin views

Data Sources in Grafana 2.0 are now pluggable. Further work is necessary to fully support all features in all plugins. Data Sources are no longer defined in a config file; they're managed through the UI or HTTP API. 

The Grafana backend is capable of proxying Data Source metric requests and data. This eliminates CORS (Cross Origin Resource Sharing) issues previously associated with Graphite or OpenTSDB. For InfluxDB users, Grafana is now able to hide authentication information from individual Users.

## InfluxDB 0.9.x support

A new Data Source for InfluxDB 0.9.x is provided with Grafana 2.0. This Data Source is provided on an experimental basis. The existing InfluxDB DataSource has been renamed InfluxDB 0.8.x. 

We continue to track the InfluxDB project closely, and aspire to offer the best possible experience for their evolving query language.

## Relative time now delay

A commonly reported problem has been graphs dipping to zero at the the end, because metric data for
the last interval has yet to be written to the Data Source. These graphs then "self correct" once the data comes in, but can look deceiving or alarming at times. 

You can avoid this problem by adding a `now delay` in `Dashboard Settings` > `Time Picker` tab. This will effectively cause Grafana to ignore the most recent data up to the set delay. The necessary delay will depend on how much latency you have in your collection pipeline.

![](/img/v2/timepicker_now_delay.jpg)

## Overwrite protection

Grafana v2.0 will protect Users from accidentally overwriting another Users changes. Similar protections are in place if you try to create a new Dashboard with the same name as an existing one.

These protections are only the first step; we will be building out additional capabilities around dashboard versioning and management in future versions of Grafana.

![](/img/v2/overwrite_protection.jpg)


## Server-side panel images and iframe embedding

Grafana now supports server-side PNG rendering. From the Panel share dialog you now have access to a link that will render the Panel to a PNG image.

Below you should see an example server-side png rendered panel:

[link]

> **Note** This requires that your Data Source is accessible from your Grafana instance.

![](/img/v2/share_dialog_image_highlight.jpg)

## Server-side Panel IFrame embedding

You can now embed a single Panel on another web page using the Panel share dialog. 

Below you should see an example IFrame with a graph panel (taken from dashoard snapshot at [snapshot.raintank.io](http://snapshot.raintank.io).

<iframe src="http://snapshot.raintank.io/dashboard/solo/snapshot/UtvRYDv650fHOV2jV5QlAQhLnNOhB5ZN?panelId=4&fullscreen&from=1427385145990&to=1427388745990" width="650" height="300" frameborder="0"></iframe>
