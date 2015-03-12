---
page_title: Changes and new features in Grafana v2.0
page_description: Changes and new features in Grafana v2.0
page_keywords: grafana, changes, features, documentation
---

# Changes and new features in v2.0

This is a guide that descriptes some of changes and new features that can be found in Grafana v2.0.


## New dashboard top header

<img class="no-shadow" src="/img/v2/v2_top_nav_annotated.png">

1. Side menu toggle
2. Dashboard search (also includes access to New dashboard, Import & Playlist)
3. Dashboard title
4. Star/unstar current dashboard
5. Share current dashboard (Make sure the dashboard is saved before)
6. Save current dashboard
7. Settings dropdown
  - Dashboard settings
  - Annotations
  - Templating
  - Export (exports current dashboard to json file)
  - View JSON (view current dashboard json model)
  - Save As... (Copy & Save current dashboard under a new name)
  - Delete dashboard

> **Note** In Grafana v2.0 when you change the title of a dashboard and then save it it will no
> longer create a new dashboard. It will just change the name for the current dashboard.
> To change name and create a new dashboard use the `Save As...` menu option

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

## New search view & starring dashboards

![](/img/v2/dashboard_search.jpg)

The dashboard search view has received a big UI update and polish. You can now see and filter by which dashboard
you have personally starred.

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

A problem that has plagued many is the fact that graphs tend to dip to zero by the end because metrics for
the last interval has yet to be received by the time series database. You can now work around this by adding
a now delay in `Dashboard Settings` > `Time Picker` tab.

![](/img/v2/timepicker_now_delay.jpg)

## Overwrite protection

Grafana v2.0 will protect you and your other Grafana users from accidentally overwriting each others changes
to the same dashboard. The same protection also applies if you try to create a new dashboard with a
name that already exists.

![](/img/v2/overwrite_protection.jpg)

## User preferences

If you open side menu (by clicking on the Grafana icon in the top header) you can access your profile page.
Here you can update your user details, UI Theme and change password.

## PNG rendering

In the panel share dialog you now have access to a link that will render the panel to a PNG image.
The panel is rendered on the backend via phantomjs (headless browser). This requires that you metric
data source is accessable from your Grafana server host machine.

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
