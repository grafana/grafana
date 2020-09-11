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

The new column filter option allow you to dynamically apply value filters to any column. This is option is disabled but
can be enabled for all or a specific column using an override rule.

{{< docs-imagebox img="/img/docs/v72/table_column_filters.png" max-width="800px" caption="Table column filters" >}}

## New and improved transforms

Grafana 7.2 includes a new group by transform that allows you to group by multiple fields and add any number of aggregations for other fields.

There is also an update to the labels to fields transform that allow you to pick one label and use that as the name of the value field.

The UI for transforms also has an update that now allows you to move transformations up and down.

## Field override matchers

You can now add override rules that use a regex matcher and overrides that match on field type.

## Sensitive alert notification channel settings are now stored encrypted in the database

Before Grafana v7.2 alert notification channels did not store sensitive settings/secrets such as API tokens and password encrypted in the database. In Grafana v7.2, creating a new alert notification channel will store sensitive settings encrypted in the database.

Please read the [upgrade notes]({{< relref "../installation/upgrading.md#ensure-encryption-of-existing-alert-notification-channel-secrets" >}}) for more information and how to migrate.

## Grafana Enterprise features

General features are included in the Grafana Enterprise edition software.

### Report time range

Report time range can be now customized separately per report, in the report form. By default, the time range from the report's dashboard would apply.

### Organization-wide report settings

You can now configure organization-wide report settings, such as report branding, in the **Settings** tab on the **Reporting** page. Settings are applied to all the reports for current organization.

{{< docs-imagebox img="/img/docs/enterprise/reports_settings.png" max-width="500px" class="docs-image--no-shadow" caption="Reports settings" >}}

### Report grid layout

A new layout option is available to render reports: the grid layout. With this option, your reports will be closer to your dashboards by showing panels in the same layout as they appear on the dashboard. 

The grid layout is also available for the [Export dashboard as PDF]({{< relref "../enterprise/export-pdf.md" >}}) feature. 

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.

