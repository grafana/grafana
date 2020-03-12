+++
title = "What's new in Grafana v4.1"
description = "Feature and improvement highlights for Grafana v4.1"
keywords = ["grafana", "new", "documentation", "4.1.0", "release notes"]
type = "docs"
[menu.docs]
name = "Version 4.1"
identifier = "v4.1"
parent = "whatsnew"
weight = 3
+++

## What's new in Grafana v4.1
- **Graph**: Support for shared tooltip on all graphs as you hover over one graph. [#1578](https://github.com/grafana/grafana/pull/1578), [#6274](https://github.com/grafana/grafana/pull/6274)
- **Victorops**: Add VictorOps notification integration [#6411](https://github.com/grafana/grafana/issues/6411), thx [@ichekrygin](https://github.com/ichekrygin)
- **Opsgenie**: Add OpsGenie notification integratiion [#6687](https://github.com/grafana/grafana/issues/6687), thx [@kylemcc](https://github.com/kylemcc)
- **Cloudwatch**: Make it possible to specify access and secret key on the data source config page [#6697](https://github.com/grafana/grafana/issues/6697)
- **Elasticsearch**: Added support for Elasticsearch 5.x [#5740](https://github.com/grafana/grafana/issues/5740), thx [@lpic10](https://github.com/lpic10)
- **Panel**: Added help text for panels. [#4079](https://github.com/grafana/grafana/issues/4079), thx [@utkarshcmu](https://github.com/utkarshcmu)
- [Full changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md)

### Shared tooltip

{{< imgbox max-width="60%" img="/img/docs/v41/shared_tooltip.gif" caption="Shared tooltip" >}}

Showing the tooltip on all panels at the same time has been a long standing request in Grafana and we are really happy to finally be able to release it.
You can enable/disable the shared tooltip from the dashboard settings menu or cycle between default, shared tooltip and shared crosshair by pressing Ctrl/Cmd+O.

<div class="clearfix"></div>

### Help text for panel

{{< imgbox max-width="60%" img="/img/docs/v41/helptext_for_panel_settings.png" caption="Hovering help text" >}}

You can set a help text in the general tab on any panel. The help text is using Markdown to enable better formatting and linking to other sites that can provide more information.

<div class="clearfix"></div>

{{< imgbox max-width="60%" img="/img/docs/v41/helptext_hover.png" caption="Hovering help text" >}}

Panels with a help text available have a little indicator in the top left corner. You can show the help text by hovering the icon.
<div class="clearfix"></div>

### Easier Cloudwatch configuration

{{< imgbox max-width="60%" img="/img/docs/v41/cloudwatch_settings.png" caption="Cloudwatch configuration" >}}

In Grafana 4.1.0 you can configure your Cloudwatch data source with `access key` and `secret key` directly in the data source configuration page.
This enables people to use the Cloudwatch data source without having access to the filesystem where Grafana is running.

Once the `access key` and `secret key` have been saved the user will no longer be able to view them.
<div class="clearfix"></div>

## Upgrade and Breaking changes

Elasticsearch 1.x is no longer supported. Please upgrade to Elasticsearch 2.x or 5.x. Otherwise Grafana 4.1.0 contains no breaking changes.

## Changelog

Check out the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list
of new features, changes, and bug fixes.

## Download

Head to [v4.1 download page](/download/4_1_0/) for download links and instructions.

## Thanks
A big thanks to all the Grafana users who contribute by submitting PRs, bug reports and feedback!
