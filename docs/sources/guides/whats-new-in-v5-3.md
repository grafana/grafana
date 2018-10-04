+++
title = "What's New in Grafana v5.3"
description = "Feature & improvement highlights for Grafana v5.3"
keywords = ["grafana", "new", "documentation", "5.3"]
type = "docs"
[menu.docs]
name = "Version 5.3"
identifier = "v5.3"
parent = "whatsnew"
weight = -9
+++

# What's New in Grafana v5.3

Grafana v5.3 brings new features, many enhancements and bug fixes. This article will detail the major new features and enhancements.

- [Google Stackdriver]({{< relref "#google-stackdriver" >}}) as a core datasource!
- [TV mode]({{< relref "#tv-and-kiosk-mode" >}}) is improved and more accessible
- [Alerting]({{< relref "#notification-reminders" >}}) with notification reminders
- [Postgres]({{< relref "#postgres-query-builder" >}}) gets a new query builder!
- [OAuth]({{< relref "#improved-oauth-support-for-gitlab" >}}) support for Gitlab is improved
- [Annotations]({{< relref "#annotations" >}}) with template variable filtering

## Google Stackdriver

Grafana v5.3 ships with built-in support for [Google Stackdriver](https://cloud.google.com/stackdriver/) and enables you to visualize your Stackdriver metrics in Grafana.

The datasource is still in the `beta` phase, meaning it's currently in active development and is still missing a few important features (templating queries, support for metrics with distribution type).
Please try it out, but be aware of that it might be subject to changes and possible bugs. We would love to hear your feedback.

Please read [Using Google Stackdriver in Grafana](/features/datasources/stackdriver/) for more detailed information on how to get started and use it.

## TV and Kiosk Mode

{{< docs-imagebox img="/img/docs/v53/tv_mode_still.png" max-width="600px" class="docs-image--no-shadow docs-image--right" animated-gif="/img/docs/v53/tv_mode.gif" >}}

We've improved the TV & kiosk mode to make it easier to use. There's now an icon in the top bar that will let you cycle through the different view modes.

1. In the first view mode, the sidebar and most of the buttons in the top bar will be hidden.
2. In the second view mode, the top bar is completely hidden so that only the dashboard itself is shown.
3. Hit the escape key to go back to the default view mode.

When switching view modes, the url will be updated to reflect the view mode selected. This allows a dashboard to be opened with a
certain view mode enabled. Additionally, this also enables [playlists](/reference/playlist) to be started with a certain view mode enabled.

<div class="clearfix"></div>

## Notification Reminders

Do you use Grafana alerting and have some notifications that are more important than others? Then it's possible to set reminders so that you continue to be alerted until the problem is fixed. This is done on the notification channel itself and will affect all alerts that use that channel.
For additional examples of why reminders might be useful for you, see [multiple series](/alerting/rules/#multiple-series).

Learn how to enable and configure reminders [here](/alerting/notifications/#send-reminders).

## Postgres Query Builder

Grafana 5.3 comes with a new graphical query builder for Postgres. This brings Postgres integration more in line with some of the other datasources and makes it easier for both advanced users and beginners to work with timeseries in Postgres. Learn more about it in the [documentation](/features/datasources/postgres/#query-editor).

{{< docs-imagebox img="/img/docs/v53/postgres_query_still.png" class="docs-image--no-shadow" animated-gif="/img/docs/v53/postgres_query.gif" >}}

## Improved OAuth Support for Gitlab

Grafana 5.3 comes with a new OAuth integration for Gitlab that enables configuration to only allow users that are a member of certain Gitlab groups to authenticate. This makes it possible to use Gitlab OAuth with Grafana in a shared environment without giving everyone access to Grafana.
Learn how to enable and configure it in the [documentation](/auth/gitlab/).

## Annotations
 it possible to use template vari
Grafana 5.3 brings improved support for [native annotations](/reference/annotations/#native-annotations) and makes it possible to use template variables when filtering by tags.
Learn more about it in the [documentation](/reference/annotations/#query-by-tag).

{{< docs-imagebox img="/img/docs/v53/annotation_tag_filter_variable.png" max-width="600px" >}}

## Changelog

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list
of new features, changes, and bug fixes.
