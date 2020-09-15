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

This article is not complete yet. We will be adding new details over the coming days as we get closer to a stable
release.

The main highlights are:

- [**Date formatting options**]({{< relref "#date-formatting-options" >}})
- [**Table column filters**]({{< relref "#table-column-filters" >}})
- [**New and improved transforms**]({{< relref "#new-and-improved-transforms" >}})
- [**Field override matchers**]({{< relref "#field-override-matchers" >}})
- [**Grafana Enterprise features**]({{< relref "#grafana-enterprise-features" >}})
  - [**Report time range**]({{< relref "#report-time-range" >}})
  - [**Organization-wide report settings**]({{< relref "#organization-wide-report-settings" >}})
  - [**Report grid layout**]({{< relref "#report-grid-layout" >}})

## Date formatting options

Now you can finally customize how dates are formatted in Grafana. Both in the time range picker, graphs and other panels.

Example:
{{< docs-imagebox img="/img/docs/v72/date_formats.png" max-width="800px" caption="Custom date time formats" >}}

The above screenshot shows both a custom full date format with a 12 hour clock and am/pm suffix. The Graph is also
showing same 12 hour clock format and a customized month and day format compared to the Grafana default `MM/DD` format.

Currently date formats can only be changed via [server wide settings]({{< relref
"../administration/configuration.md#date_formats" >}}) but we hope to add org and potentially user level
settings in the future.

```
[date_formats]
full_date = MMM Do, YYYY @ hh:mm:ss a
interval_second = hh:mm:ss a
interval_minute = hh:mm a
interval_hour = MMM DD hh:mm a
interval_day = MMM DD
interval_month = YYYY-MM
interval_year = YYYY
```

There is also experimental support to use Browser locale/language to dynamically change the current date format
for each user. This feature is disabled by default as it needs more testing and refinement.

## Table column filters

The new column filter option allows you to dynamically apply value filters to any column. This option is disabled but
can be enabled for all or a specific column using an override rule.

{{< docs-imagebox img="/img/docs/v72/table_column_filters.png" max-width="800px" caption="Table column filters" >}}

## New and improved transforms

Grafana 7.2 includes a new group by transform that allows you to group by multiple fields and add any number of aggregations for other fields.

There is also an update to the labels to fields transform that allow you to pick one label and use that as the name of the value field.

The UI for transforms also has an update that now allows you to move transformations up and down.

{{< docs-imagebox img="/img/docs/v72/transformations.gif" max-width="800px" caption="Group by and reordering of transformations" >}}

## Field override matchers

You can now add override rules that use a regex matcher and overrides that match on field type.

## Sensitive alert notification channel settings are now stored encrypted in the database

Before Grafana v7.2 alert notification channels did not store sensitive settings/secrets such as API tokens and password encrypted in the database. In Grafana v7.2, creating a new alert notification channel will store sensitive settings encrypted in the database.

Please read the [upgrade notes]({{< relref "../installation/upgrading.md#ensure-encryption-of-existing-alert-notification-channel-secrets" >}}) for more information and how to migrate.

## Grafana Enterprise features

General features are included in the Grafana Enterprise edition software.

### Report grid layout

A new layout option is available when rendering reports: the grid layout. With this option your report will use the panel layout from your dashboard so that what you see is what you get.  Learn more about the [grid layout]({{< relref "../enterprise/reporting.md#layout-and-orientation.md" >}}) in the documentation.

The grid layout is also available for the [Export dashboard as PDF]({{< relref "../enterprise/export-pdf.md" >}}) feature. 

{{< docs-imagebox img="/img/docs/enterprise/reports_grid_landscape_preview.png" max-width="500px" class="docs-image--no-shadow" >}}

### Report time range

A report can now be set up with a different time range from the dashboard it is based on. This means you no longer have to apply workarounds such as copying dashboards or carefully aligning report generation with the end of the month to generate reports that covers the period you want. The dashboard's stored time range remains the default option.

### Organization-wide report settings

You can now configure organization-wide report settings, such as report branding, in the **Settings** tab on the **Reporting** page. Settings are applied to all the reports of your current organization.

{{< docs-imagebox img="/img/docs/enterprise/reports_settings.png" max-width="500px" class="docs-image--no-shadow" caption="Reports settings" >}}

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.

## What's new in other parts of the Grafana ecosystem

### ADX (Azure Data Explorer) plugin
In collaboration with Microsoft we have started to improve the usability of our ADX datasource plugin by adding a visual query builder. The goal is to make it easier for users, regardless of their previous knowledge of writing KQL (Kusto Query Language) queries, to query and visualize their data.

{{< docs-imagebox img="/img/docs/v72/adx-ds.png" max-width="800px" caption="ADX visual query builder" >}}
