+++
title = "What's new in Grafana v5.3"
description = "Feature and improvement highlights for Grafana v5.3"
keywords = ["grafana", "new", "documentation", "5.3", "release notes"]
type = "docs"
[menu.docs]
name = "Version 5.3"
identifier = "v5.3"
parent = "whatsnew"
weight = -9
+++

# What's new in Grafana v5.3

Grafana v5.3 brings new features, many enhancements and bug fixes. This article will detail the major new features and enhancements.

- [Google Stackdriver]({{< relref "#google-stackdriver" >}}) as a core data source!
- [TV mode]({{< relref "#tv-and-kiosk-mode" >}}) is improved and more accessible
- [Alerting]({{< relref "#notification-reminders" >}}) with notification reminders
- [Postgres]({{< relref "#postgres-query-builder" >}}) gets a new query builder!
- [OAuth]({{< relref "#improved-oauth-support-for-gitlab" >}}) support for GitLab is improved
- [Annotations]({{< relref "#annotations" >}}) with template variable filtering
- [Variables]({{< relref "#variables" >}}) with free text support

## Google Stackdriver

{{< docs-imagebox img="/img/docs/v53/stackdriver-with-heatmap.png"  max-width= "600px" class="docs-image--no-shadow docs-image--right" >}}

Grafana v5.3 ships with built-in support for [Google Stackdriver](https://cloud.google.com/stackdriver/) and enables you to visualize your Stackdriver metrics in Grafana.

Getting started with the plugin is easy. Simply create a GCE Service account that has access to the Stackdriver API scope, download the Service Account key file from Google and upload it on the Stackdriver data source config page in Grafana and you should have a secure server-to-server authentication setup. Like other core plugins, Stackdriver has built-in support for alerting. It also comes with support for heatmaps and basic variables.

If you're already accustomed to the Stackdriver Metrics Explorer UI, you'll notice that there are a lot of similarities to the query editor in Grafana. It is possible to add filters using wildcards and regular expressions. You can do Group By, Primary Aggregation and Alignment.

Alias By allows you to format the legend the way you want, and it's a feature that is not yet present in the Metrics Explorer. Two other features that are only supported in the Grafana plugin are the abilities to manually set the Alignment Period in the query editor and to add Annotations queries.

The Grafana Stackdriver plugin comes with support for automatic unit detection. Grafana will try to map the Stackdriver unit type to a corresponding unit type in Grafana, and if successful the panel Y-axes will be updated accordingly to display the correct unit of measure. This is the first core plugin to provide support for unit detection, and it is our intention to provide support for this in other core plugins in the near future.

The data source is still in the `beta` phase, meaning it's currently in active development and is still missing one important feature - templating queries.
Please try it out, but be aware of that it might be subject to changes and possible bugs. We would love to hear your feedback.

Please read [Using Google Stackdriver in Grafana](/features/datasources/stackdriver/) for more detailed information on how to get started and use it.

## TV and Kiosk Mode

{{< docs-imagebox img="/img/docs/v53/tv_mode_still.png" max-width="600px" class="docs-image--no-shadow docs-image--right" animated-gif="/img/docs/v53/tv_mode.gif" >}}

We've improved the TV and kiosk mode to make it easier to use. There's now an icon in the top bar that will let you cycle through the different view modes.

1. In the first view mode, the sidebar and most of the buttons in the top bar will be hidden.
2. In the second view mode, the top bar is completely hidden so that only the dashboard itself is shown.
3. Hit the escape key to go back to the default view mode.

When switching view modes, the URL will be updated to reflect the view mode selected. This allows a dashboard to be opened with a
certain view mode enabled. Additionally, this also enables [playlists](/dashboards/playlist) to be started with a certain view mode enabled.

<div class="clearfix"></div>

## Notification Reminders

Do you use Grafana alerting and have some notifications that are more important than others? Then it's possible to set reminders so that you continue to be alerted until the problem is fixed. This is done on the notification channel itself and will affect all alerts that use that channel.
For additional examples of why reminders might be useful for you, see [multiple series](/alerting/alerts-overview/#multiple-series).

Learn how to enable and configure reminders [here](/alerting/notifications/#send-reminders).

## Postgres Query Builder

Grafana 5.3 comes with a new graphical query builder for Postgres. This brings Postgres integration more in line with some of the other data sources and makes it easier for both advanced users and beginners to work with timeseries in Postgres. Learn more about it in the [documentation](/features/datasources/postgres/#query-editor).

{{< docs-imagebox img="/img/docs/v53/postgres_query_still.png" class="docs-image--no-shadow" animated-gif="/img/docs/v53/postgres_query.gif" >}}

## Improved OAuth Support for GitLab

Grafana 5.3 comes with a new OAuth integration for GitLab that enables configuration to only allow users that are a member of certain GitLab groups to authenticate. This makes it possible to use GitLab OAuth with Grafana in a shared environment without giving everyone access to Grafana.
Learn how to enable and configure it in the [documentation](/auth/gitlab/).

## Annotations

Grafana 5.3 brings improved support for [native annotations](/dashboards/annotations/#native-annotations) and makes it possible to use template variables when filtering by tags.
Learn more about it in the [documentation](/dashboards/annotations/#query-by-tag).

{{< docs-imagebox img="/img/docs/v53/annotation_tag_filter_variable.png" max-width="600px" >}}

## Variables

Grafana 5.3 ships with a brand new variable type named `Text box` which makes it easier and more convenient to provide free text input to a variable.
This new variable type will display as a free text input field with an optional prefilled default value.

## Changelog

Check out the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list
of new features, changes, and bug fixes.
