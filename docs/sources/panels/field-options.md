+++
title = "Field options"
type = "docs"
aliases = ["/docs/grafana/latest/panels/field-configuration-options/"]
[menu.docs]
parent = "panels"
weight = 300
+++

# Field options and overrides

This page explains what field options and field overrides in Grafana are and how to use them. It also includes [examples](#examples) if you need an idea of how this feature might be useful in the real world.

The data model used in Grafana, the [data frame]({{< relref "../developers/plugins/data-frames.md" >}}), is a columnar-oriented table structure that unifies both time series and table query results. Each column within this structure is called a _field_. A field can represent a single time series or table column.

## Field options

Field options allow you to change how the data is displayed in your visualizations. Options and overrides that you apply do not change the data, they change how Grafana displays the data.

_Field options_, both standard and custom, can be found in the **Field** tab in the panel editor. Changes on this tab apply to all fields (i.e. series/columns). For example, if you change the unit to percentage, then all fields with numeric values are displayed in percentages. [Apply a field option](#configure-all-fields).

## Field overrides

_Field overrides_ can be added in the **Overrides** tab in the panel editor. There you can add the same options as you find in the **Field** tab, but they are only applied to specific fields. [Apply an override](#override-a-field).

All [field options](#field-options) are defined below.




