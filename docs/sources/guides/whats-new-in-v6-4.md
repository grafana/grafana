+++
title = "What's New in Grafana v6.4"
description = "Feature & improvement highlights for Grafana v6.4"
keywords = ["grafana", "new", "documentation", "6.4"]
type = "docs"
[menu.docs]
name = "Version 6.4"
identifier = "v6.4"
parent = "whatsnew"
weight = -14
+++

# What's New in Grafana v6.4

For all details please read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)

## Highlights

Grafana 6.4 comes with a lot of new features and enhancements backed with tons of work around [Grafana's data model]({{< relref "#maturing-grafana-data-model" >}}):

- New Explore features
  - [Saving panel query from Explore]({{< relref "#saving-panel-query-from-explore" >}})
  - [Annotations using Loki]({{< relref "#annotations-using-loki" >}})
  - [Live tailing improvements]({{< relref "#live-tailing-improvements" >}})
- [Logs Panel - alpha]({{< relref "#logs-panel-alpha" >}})
- [Data links improvements]({{< relref "#data-links-improvements" >}})
- [Maturing Grafana data model]({{< relref "#maturing-grafana-data-model" >}})
- [Alpha version of grafana-toolkit]({{< relref "#alpha-version-of-grafana-toolkit" >}})
- [PhantomJS deprecation]({{< relref "#phantomjs-deprecation" >}})
- [Alpine based docker image]({{< relref "#alpine-based-docker-image" >}})
- Grafana Enterprise
  - [Reporting]({{< relref "#reporting" >}})
  - [GitLab OAuth Team Sync support]({{< relref "#gitlab-oauth-team-sync-support" >}})
  - [Teams support in LDAP Debug View]({{< relref "#teams-support-in-ldap-debug-view" >}})

## New Explore features

### Saving panel query from Explore

TODO

### Logs Panel Alpha

TODO

### Annotations using Loki

TODO

### Live tailing improvements

TODO

## Data Links improvements

With grafana 6.3 we introduced new way of creating [Data Links](https://grafana.com/blog/2019/08/27/new-in-grafana-6.3-easy-to-use-data-links/). Grafana 6.4 expands Data Links availability to Gauge, Bar Gauge and SingleStat(alpha) panels and adds new variables allowing retrieval of i.e. series labels/tags.

Read more about Data Links and what you can do with them in [documentation](https://grafana.com/docs/features/panels/graph/#data-link)

## Maturing Grafana's data model

TODO Ryan

## Alpha version of grafana-toolkit

TODO Dominik

## PhantomJS deprecation

TODO

## Alpine based docker image

TODO

## Grafana Enterprise

Substantial refactoring and improvements to the external auth systems has gone in to this release making the  features
listed below possible as well as laying a foundation for future enhancements.

### Reporting

TODO

### GitLab OAuth Support

TODO

### Teams support in LDAP Debug View

TODO

