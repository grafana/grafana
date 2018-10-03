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

- [TV mode]({{< relref "#tv-and-kiosk-mode" >}}) is improved
- [Alerting]({{< relref "#notification-reminders" >}}) with notification reminders
- [Postgres]({{< relref "#postgres-query-builder" >}}) gets a new query builder!
- [OAuth]({{< relref "#improved-oauth-support-for-gitlab" >}}) support for Gitlab is improved

## TV and kiosk mode

We've improved the TV & kiosk mode to make it easier to use. There's now an icon in the top bar that will let you cycle through the different display modes.

Clicks:

1. (TV mode) Removes the sidebar and most of the buttons in the top bar
2. (Kiosk mode) Removes the top bar completely so that only the dashboard itself is showing

Hit the escape key to go back to the default mode.

**gif here**

## Notification reminders

Do you use Grafana alerting and have some notifications that are more important than others? Then it's possible to set reminders so that you get alerted until the problem is fixed. This is done on the notification channel itself and will affect all alerts that use that channel. Read more about reminders [here](http://docs.grafana.org/alerting/notifications/#send-reminders)

## Postgres query builder

Grafana 5.3 comes with a new graphical query builder for Postgres. Bringing Postgres integration more in line with some of the other datasources and making it easier for both advanced and beginners to work with timeseries in Postgres. Learn more about it in the [documentation](http://docs.grafana.org/features/datasources/postgres/#query-editor).

{{< docs-imagebox img="/img/docs/v53/postgres_query_still.png" class="docs-image--no-shadow" animated-gif="/img/docs/v53/postgres_query.gif" >}}

## Improved OAuth support for Gitlab

Grafana 5.3 gets native support for Gitlab OAuth with filtering to specific groups. This is makes it possible to use Gitlab OAuth with Grafana in a shared environment without giving everyone access to Grafana. More on usage in the [documentation](http://docs.grafana.org/auth/gitlab/).

## Changelog

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list
of new features, changes, and bug fixes.
