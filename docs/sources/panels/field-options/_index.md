+++
title = "Field options and overrides"
type = "docs"
keywords = ["grafana", "field options", "documentation", "format fields"]
aliases = ["/docs/grafana/latest/panels/field-configuration-options/", "/docs/grafana/latest/panels/field-options/"]
[menu.docs]
weight = 500
+++

# Field options and overrides

This section explains what field options and field overrides in Grafana are and how to use them. It also includes [examples](#examples) if you need an idea of how this feature might be useful in the real world.

The data model used in Grafana, the [data frame]({{< relref "../../developers/plugins/data-frames.md" >}}), is a columnar-oriented table structure that unifies both time series and table query results. Each column within this structure is called a _field_. A field can represent a single time series or table column.

Field options allow you to change how the data is displayed in your visualizations. Options and overrides that you apply do not change the data, they change how Grafana displays the data.

## Field options

_Field options_, both standard and custom, can be found in the Field tab in the panel editor. Changes on this tab apply to all fields (i.e. series/columns). For example, if you change the unit to percentage, then all fields with numeric values are displayed in percentages. Learn how to apply a field option in [Configure all fields]({{< relref "configure-all-fields.md" >}}).

## Field overrides

_Field overrides_ can be added in the Overrides tab in the panel editor. There you can add the same options as you find in the Field tab, but they are only applied to specific fields. Learn how to apply an override in [Configure specific fields]({{< relref "configure-specific-fields.md" >}}).

## Available field options and overrides

Field option types are common to both field options and field overrides. The only difference is whether the change will apply to all fields (apply in the Field tab) or to a subset of fields (apply in the Overrides tab).

- [Standard field options]({{< relref "standard-field-options.md" >}}) apply to all panel visualizations that allow transformations.
- [Table field options]({{< relref "../visualizations/table/table-field-options.md" >}}), which only apply to table panel visualizations.

## Examples

Here are some examples of how you might use this feature:

- [Field option example]({{< relref "configure-all-fields.md#field-option-example" >}})
- [Field override example]({{< relref "configure-specific-fields.md#field-override-example" >}})
