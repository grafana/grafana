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
- [Postgres query builder]({{< relref "#postgres-query-builder" >}}) it's finally here!
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

Grafana 5.3 comes with a new graphical query builder for Postgres. Bringing Postgres integration more in line with some the other datasources and making it easier for both advanced and beginners to work with timeseries in Postgres.

## Improved OAuth support for Gitlab

Grafana 5.3 now supports filtering to specific groups when using Gitlab OAuth. This is makes it possible to use Gitlab OAuth with Grafana in a shared environment without giving access to Grafana to everyone.

## Changelog

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list
of new features, changes, and bug fixes.
