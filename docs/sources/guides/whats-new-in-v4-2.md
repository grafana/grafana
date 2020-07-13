+++
title = "What's new in Grafana v4.2"
description = "Feature and improvement highlights for Grafana v4.2"
keywords = ["grafana", "new", "documentation", "4.2.0", "release notes"]
type = "docs"
[menu.docs]
name = "Version 4.2"
identifier = "v4.2"
parent = "whatsnew"
weight = -1
+++

## What's new in Grafana v4.2

Grafana v4.2 Beta is now [available for download](https://grafana.com/grafana/download/4.2.0).
Just like the last release this one contains lots bug fixes and minor improvements.
We are very happy to say that 27 of 40 issues was closed by pull requests from the community.
Big thumbs up!

## Release Highlights

- **Hipchat**: Adds support for sending alert notifications to hipchat [#6451](https://github.com/grafana/grafana/issues/6451), thx [@jregovic](https://github.com/jregovic)
- **Telegram**: Added Telegram alert notifier [#7098](https://github.com/grafana/grafana/pull/7098), thx [@leonoff](https://github.com/leonoff)
- **LINE**: Add LINE as alerting notification channel [#7301](https://github.com/grafana/grafana/pull/7301), thx [@huydx](https://github.com/huydx)
- **Templating**: Make $__interval and $__interval_ms global built in variables that can be used in by any data source (in panel queries), closes [#7190](https://github.com/grafana/grafana/issues/7190), closes [#6582](https://github.com/grafana/grafana/issues/6582)
- **Alerting**: Adds deduping of alert notifications [#7632](https://github.com/grafana/grafana/pull/7632)
- **Alerting**: Better information about why an alert triggered [#7035](https://github.com/grafana/grafana/issues/7035)
- **Orgs**: Sharing dashboards using Grafana share feature will now redirect to correct org. [#6948](https://github.com/grafana/grafana/issues/6948)
- [Full changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)

### New alert notification channels

This release adds **five** new alert notifications channels, all of them contributed by the community.

* Hipchat
* Telegram
* LINE
* Pushover
* Threema

### Templating

We added two new global built in variables in grafana. `$__interval` and `$__interval_ms` are now reserved template names in grafana and can be used by any data source.
We might add more global built in variables in the future and if we do we will prefix them with `$__`. So please avoid using that in your template variables.

### Dedupe alert notifications when running multiple servers

In this release we will dedupe alert notifications when you are running multiple servers.
This makes it possible to run alerting on multiple servers and only get one notification.

We currently solve this with sql transactions which puts some limitations for how many servers you can use to execute the same rules.
3-5 servers should not be a problem but as always, it depends on how many alerts you have and how frequently they execute.

Next up for a better HA situation is to add support for workload balancing between Grafana servers.

### Alerting more info

You can now see the reason why an alert triggered in the alert history. Its also easier to detect when an alert is set to `alerting` due to the `no_data` option.

### Improved support for multi-org setup

When loading dashboards we now set an query parameter called orgId. So we can detect from which org an user shared a dashboard.
This makes it possible for users to share dashboards between orgs without changing org first.

We aim to introduce [dashboard groups](https://github.com/grafana/grafana/issues/1611) sometime in the future which will introduce access control and user groups within one org.
Making it possible to have users in multiple groups and have detailed access control.

## Upgrade and Breaking changes

If you're using HTTPS in grafana we now force you to use TLS 1.2 and the most secure ciphers.
We think its better to be secure by default rather then making it configurable.
If you want to run HTTPS with lower versions of TLS we suggest you put a reserve proxy in front of grafana.

If you have template variables name `$__interval` or `$__interval_ms` they will no longer work since these keywords
are reserved as global built in variables. We might add more global built in variables in the future and if we do, we will prefix them with `$__`. So please avoid using that in your template variables.

## Changelog

Check out the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list
of new features, changes, and bug fixes.

## Download

Head to [v4.2-beta download page](/download/4_2_0/) for download links and instructions.

## Thanks

A big thanks to all the Grafana users who contribute by submitting PRs, bug reports and feedback!
