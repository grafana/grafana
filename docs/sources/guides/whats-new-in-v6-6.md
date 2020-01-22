+++
title = "What's New in Grafana v6.6"
description = "Feature and improvement highlights for Grafana v6.6"
keywords = ["grafana", "new", "documentation", "6.6"]
type = "docs"
[menu.docs]
name = "Version 6.6"
identifier = "v6.6"
parent = "whatsnew"
weight = -16
+++

# What's New in Grafana v6.6

For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)

## Highlights

Grafana 6.6 comes with a lot of new features and enhancements:

- [**Panels:** New stat panel]({{< relref "#new-stat-panel" >}})
- [**Panels:** Auto min/max for Bar Gauge/Gauge/Stat]({{< relref "#auto-min-max" >}})
- [**Panels:** News panel]({{< relref "#news-panel" >}})
- [**TimePicker:** New design & features]({{< relref "#new-time-picker" >}})
- [**Panels:** Custom data units]({{< relref "#custom-data-units" >}})
- [**Alerting enhancements**]({{< relref "#alerting-enhancements" >}})
- **Explore:** Added log message line wrapping options for logs
- **Graphite:** Added Metrictank dashboard to Graphite datasource
- **Loki:** Support for template variable queries
- **Postgres/MySQL/MSSQL:** Added support for region annotations
- **Explore:** Added ability to specify step with Prometheus queries
- [**Security:** Added disabled option for cookie samesite attribute]({{< relref "#cookie-management-modifications" >}})
- **TablePanel, GraphPanel:** Exclude hidden columns from CSV

More details will be added as we're getting closer to the stable release.

## New stat panel

{{< docs-imagebox img="/img/docs/v66/stat_panel_dark.png" max-width="1024px" caption="Stat panel" >}}

This release adds a new panel named `Stat`. This panel is designed to replace the current `Singlestat` as the primary way
to show big single number panels along with a sparkline. This panel is of course building on our new panel
infrastructure and option design. So you can use the new thresholds UI and data links. It also supports the same
repeating feature as Gauge & Bar Gauge panels, meaning it will repeat a separate visualization for every series or row
in the query result.

Key features:

- Automatic font size handling
- Automatic layout handling based on panel size
- Colors based on thresholds that adapt to light or dark theme
- Data links support
- Repeats horizontally or vertically for every series, row or column

Here is how it looks in light theme:

{{< docs-imagebox img="/img/docs/v66/stat_panel_light.png" max-width="1024px" caption="Stat panel" >}}

## Auto min max

For the panels Gauge, Bar Gauge & Stat you can now leave the min and max settings empty. Grafana will, in that case, calculate the min & max based on
all the data.

## New time picker

The time picker has gotten a major design update. Key changes:

- Quickly access the absolute from & to input fields without an extra click.
- Calendar automatically shows when from or to inputs has focus
- A single calendar view can be used to select and show the from & to date.
- Select recent absolute ranges

{{< docs-imagebox img="/img/docs/v66/time_picker_update.png" max-width="700px" caption="New time picker" >}}

## News panel

This panel supports showing RSS feeds as news items. It is used in the updated default home dashboard. Add it to
your custom home dashboards to keep up to date with Grafana news or switch the default RSS feed to one of your choice.

{{< docs-imagebox img="/img/docs/v66/news_panel.png" max-width="600px" caption="News panel" >}}

## Custom data units

A top feature request for years is now finally here. All panels now support custom units. Just specify any text in the
unit picker and select the `Custom: <your unit>` option. By default it will be used as a suffix unit. If you want a
custom prefix just type `prefix: <your unit> ` to make the custom unit appear before the value. If you want a custom
SI unit (with auto SI suffixes) specify `si:Ups`. A value like 1000 will be rendered as `1 kUps`.

{{< docs-imagebox img="/img/docs/v66/custom_unit_burger1.png" max-width="600px" caption="Custom unit" >}}

Paste a native emoji in the unit picker and pick it as a custom unit:

{{< docs-imagebox img="/img/docs/v66/custom_unit_burger2.png" max-width="600px" caption="Custom unit emoji" >}}


## Alerting enhancements

- We have introduced a new configuration for enforcing a minimal interval between evaluations, to reduce load on the backend.
- The email notifier can now optionally send a single email to all recipients.
- OpsGenie, PagerDuty, Threema, and Google Chat notifiers have been updated to send additional information.

## Cookie management modifications

In order to align with a [change in Chrome 80](https://www.chromestatus.com/feature/5088147346030592), a breaking change has been introduced. The `[security]` setting `cookie_samesite` configured to `none` now renders cookies with `SameSite=None` attribute contrary to the previous behavior where no `SameSite` attribute was added to cookies. To get back the old behavior, you must set `cookie_samesite` to `disabled`.
