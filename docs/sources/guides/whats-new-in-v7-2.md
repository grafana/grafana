+++
title = "What's New in Grafana v7.2"
description = "Feature and improvement highlights for Grafana v7.2"
keywords = ["grafana", "new", "documentation", "7.2", "release notes"]
type = "docs"
[menu.docs]
name = "Version 7.2"
identifier = "v7.2"
parent = "whatsnew"
weight = -16
+++

# What's new in Grafana v7.2

This topic includes the release notes for the Grafana v7.2, which is currently in beta. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## Date formatting options

Now you can finally customize how dates are formatted in Grafana. Both in the time range picker, graphs and other panels.

## Table column filters
TODO

## New and improved transforms

Grafana 7.2 includes a new group by transform that allows you to group by multiple fields and add any number of aggregations for other fields.

There is also an update to the labels to fields transform that allow you to pick one label and use that as the name of the value field.

The UI for transforms also has an update that now allows you to move transformations up and down.

## Field override matchers

You can now add override rules that use a regex matcher and overrides that match on field type.

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.


