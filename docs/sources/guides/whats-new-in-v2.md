---
page_title: What's New in Grafana v2.0
page_description: What's new in Grafana v2.0
page_keywords: grafana, new, changes, features, documentation
---

# What's New in Grafana v2.0

Grafana 2.0 represents months of work by the Grafana team and the community. We are pleased to be able to
release the Grafana 2.0 beta. This is a guide that describes some of changes and new features that can
be found in Grafana V2.0.

If you are interested in how to migrate from Grafana V1.x to V2.0, please read our [Migration Guide](../installation/migrating_to2.md)

## New backend

Grafana now ships with its own backend server. Graphs are still 100% client-side rendered, but the integrated server allows for much of
the new functionality that 2.0 brings. The backend server is written in Go, has a full HTTP API, and is also completely open source.

In addition to new features, the backend server makes it much easier to set up and enjoy Grafana.
Grafana 2.0 ships as a single binary with no dependencies, and we hope to extend support to more platforms.
Authentication is built in, and Grafana is now capable of proxying connections to Data Sources.
There are no longer any CORS (Cross Origin Resource Sharing) issues requiring messy workarounds.
Elasticsearch is no longer required just to store dashboards.

## Dashboard Snapshot sharing
A Dashboard Snapshot is an easy way to create and share a URL for a stripped down, point-in-time version of any Dashboard.
You can give this URL to anyone or everyone, and they can view the Snapshot even if they're not a User of your Grafana instance.
You can set an expiration time for any Snapshots you create. When you create a Snapshot, we strip some data, like
panel metric queries, annotation and template queries and panel links. The data points displayed on
screen for that specific time period in your Dashboard is saved in the JSON of the Snapshot itself.

Sharing a Snapshot is similar to sharing a link to a screenshot of your dashboard, only way better (they'll look great at any screen resolution, you can hover over series,
even zoom in). Also they are fast to load as they aren't actually connected to any live Data Sources in any way.

They're a great way to communicate about a particular incident with specific people, or over the Internet. You can also use them to show off your dashboards.

![](/img/v2/dashboard_snapshot_dialog.png)

### Publish snapshots
You can publish snapshots to you local instance or to [snapshot.raintank.io](http://snapshot.raintank.io). The later is a free service
that is provided by [Raintank](http://raintank.io) that allows you to publish dashboard snapshots to an external grafana instance.
The same rules still apply, anyone with the link can view it.

## Panel time overrides & timeshift

In Grafana v2.x you can now override the relative time range for individual panels. You can also add a
time shift to individual panels. This allows you to show metrics from different time periods or days
at the same time.

![](/img/v2/panel_time_override.jpg)

You control these overrides in panel editor mode and the new tab `Time Range`.

![](/img/v2/time_range_tab.jpg)

Currently you can only override the dashboard time with relative time ranges, not absolute time ranges. When
you zoom or change the dashboard time to a custom absolute time range the panel overrides will be disabled. The
panel relative time override is only active when the dashboard time is also relative. The panel timeshift override
however is always active, even when the dashboard time is absolute.

The `Hide time override info` option allows you to hide the the override info text that is by default shown in the
upper right of a panel when overriden time range options.

## Panel IFrame embedding

You can embed a single panel on another web page using the panel share dialog. Below you should see an iframe
with a graph panel (taken from dashoard snapshot at [snapshot.raintank.io](http://snapshot.raintank.io). Try
hovering or zooming on the panel below!

<iframe src="http://snapshot.raintank.io/dashboard/solo/snapshot/IQ7iZF00sHalq0Ffjv6OyclJSA1YHYV1?panelId=4&fullscreen&from=1427385145990&to=1427388745990" width="650" height="300" frameborder="0"></iframe>

## New dashboard top header

<img class="no-shadow" src="/img/v2/v2_top_nav_annotated.png">

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

The side menubar provides access to features such as User Preferences, Organizations, and Data Sources.
If you have multiple Organizations, you can easily switch between them.

## New search view & starring dashboards

![](/img/v2/dashboard_search.jpg)

The dashboard search view has received a big UI update and polish. You can now see and filter by which dashboard
you have personally starred.

## Logarithmic scale

The Graph panel now supports 3 logarithmic scales, `log base 10`, `log base 32`, `log base 1024`. Logarithmic y-axis
scales are very useful when rendering many series of different order of magnitude on the same scale. For example
latency, network traffic or storage.

![](/img/v2/graph_logbase10_ms.png)

## Dashlist panel

![](/img/v2/dashlist_starred.png)

There is one new panel in Grafana v2.0 and that is the `dashlist` panel that allows you to show your personal
starred dashboards as well as do custom searches based on search strings or tags.

## Data Source proxy & admin views

Data sources in Grafana v2.0 are NOT defined in a config file but added through the UI. The backend can also
handle proxying data source metric requests which meens that it is a lot easier to get started using Grafana with
Graphite or OpenTSDB without having to spend time with nginx CORS (Cross origin resource sharing) work arounds.

> **Note** For InfluxDB users: The data source proxy feature will
> hide database user & password details from the frontend / browser.

## Relative time now delay
A commonly reported problem has been graphs dipping to zero at the the end, because metric data for
the last interval has yet to be written to the Data Source. These graphs then "self correct" once the data comes in, but can look deceiving or alarming at times.

You can avoid this problem by adding a `now delay` in `Dashboard Settings` > `Time Picker` tab. This will effectively cause Grafana to ignore the most recent data up to the set delay. The necessary delay will depend on how much latency you have in your collection pipeline.
![](/img/v2/timepicker_now_delay.jpg)

## Overwrite protection

Grafana v2.0 will protect Users from accidentally overwriting another Users changes. Similar protections are in place if you try to create a new Dashboard with the same name as an existing one.
These protections are only the first step; we will be building out additional capabilities around dashboard versioning and management in future versions of Grafana.

![](/img/v2/overwrite_protection.jpg)

## User preferences

If you open side menu (by clicking on the Grafana icon in the top header) you can access your profile page.
Here you can update your user details, UI Theme and change password.

## PNG rendering
Grafana now supports server-side PNG rendering. From the Panel share dialog you now have access to a link that will render the Panel to a PNG image.

> **Note** This requires that your Data Source is accessible from your Grafana instance.

![](/img/v2/share_dialog_image_highlight.jpg)

## User & Organization permissions

All dashboards and data sources are linked to an organization (not to a user). Users are linked to
Organizations via a role. That role can be:

- `Viewer`: Can only view dashboards, not save / create them.
- `Editor`: Can view, update and create dashboards.
- `Admin`: Everything an Editor can plus edit and add data sources and organization users.

> **Note** A `Viewer` can still view all metrics exposed through a data source, not only
> the metrics used in already existing dashboards. That is because there are not
> per series permissions in Graphite, InfluxDB or OpenTSDB.

There are currently no permissions on individual dashboards.

