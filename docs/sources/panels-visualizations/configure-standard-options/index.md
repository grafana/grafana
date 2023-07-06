---
aliases:
  - ../panels/apply-color-to-series/
  - ../panels/configure-standard-options/
  - ../panels/field-options/
  - ../panels/field-options/standard-field-options/
  - ../panels/reference-standard-field-definitions/
  - ../panels/standard-field-definitions/
  - ../panels/working-with-panels/format-standard-fields/
keywords:
  - panel
  - dashboard
  - standard
  - option
menuTitle: Configure standard options
title: Configure standard options
weight: 2
---

# Configure standard options

The data model used in Grafana, namely the [data frame]({{< relref "../../developers/plugins/introduction-to-plugin-development/data-frames/" >}}), is a columnar-oriented table structure that unifies both time series and table query results. Each column within this structure is called a _field_. A field can represent a single time series or table column.

Field options allow you to change how the data is displayed in your visualizations. Options and overrides that you apply do not change the data, they change how Grafana displays the data. When you change an option, it is applied to all fields, meaning all series or columns. For example, if you change the unit to percentage, then all fields with numeric values are displayed in percentages.

For a complete list of field formatting options, refer to [Standard options definitions]({{< relref "#standard-options-definitions" >}}).

> You can apply standard options to most built-in Grafana panels. Some older panels and community panels that have not updated to the new panel and data model will be missing either all or some of these field options.

1. Open a dashboard. Hover over any part of the panel to display the actions menu on the top right corner.
1. Click the menu and select **Edit**.
1. In the panel display options pane, locate the **Standard options** section.
1. Select the standard options you want to apply.

   For more information about standard options, refer to [Standard options definitions]({{< relref "#standard-options-definitions" >}}).

1. To preview your change, click outside of the field option box you are editing or press **Enter**.

## Standard options definitions

This section explains all available standard options.

You can apply standard options to most built-in Grafana panels. Some older panels and community panels that have not updated to the new panel and data model will be missing either all or some of these field options.

Most field options will not affect the visualization until you click outside of the field option box you are editing or press Enter.

{{% admonition type="note" %}}
We are constantly working to add and expand options for all visualization, so all options might not be available for all visualizations.
{{% /admonition %}}

### Unit

Lets you choose what unit a field should use. Click in the **Unit** field, then drill down until you find the unit you want. The unit you select is applied to all fields except time.

#### Custom units

You can use the unit dropdown to also specify custom units, custom prefix or suffix and date time formats.

To select a custom unit enter the unit and select the last `Custom: xxx` option in the dropdown.

- `suffix:<suffix>` for custom unit that should go after value.
- `prefix:<prefix>` for custom unit that should go before value.
- `time:<format>` For custom date time formats type for example `time:YYYY-MM-DD`. See [formats](https://momentjs.com/docs/#/displaying/) for the format syntax and options.
- `si:<base scale><unit characters>` for custom SI units. For example: `si: mF`. This one is a bit more advanced as you can specify both a unit and the
  source data scale. So if your source data is represented as milli (thousands of) something prefix the unit with that
  SI scale character.
- `count:<unit>` for a custom count unit.
- `currency:<unit>` for custom a currency unit.

You can also paste a native emoji in the unit picker and pick it as a custom unit:

{{< figure src="/static/img/docs/v66/custom_unit_burger2.png" max-width="600px" caption="Custom unit emoji" >}}

#### String units

Grafana can sometimes be too aggressive in parsing strings and displaying them as numbers. To configure Grafana to show the original string value, create a field override and add a unit property with the `String` unit.

### Min

Lets you set the minimum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.

### Max

Lets you set the maximum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields.

### Decimals

Specify the number of decimals Grafana includes in the rendered value. If you leave this field blank, Grafana automatically truncates the number of decimals based on the value. For example 1.1234 will display as 1.12 and 100.456 will display as 100.

To display all decimals, set the unit to `String`.

### Display name

Lets you set the display title of all fields. You can use [variables]({{< relref "../../dashboards/variables/" >}}) in the field title.

When multiple stats, fields, or series are shown, this field controls the title in each stat. You can use expressions like `${__field.name}` to use only the series name or the field name in title.

Given a field with a name of Temp, and labels of {"Loc"="PBI", "Sensor"="3"}

| Expression syntax            | Example                 | Renders to                     | Explanation                                                                                                                                                                                                        |
| ---------------------------- | ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `${__field.displayName}`     | Same as syntax          | `Temp {Loc="PBI", Sensor="3"}` | Displays the field name, and labels in `{}` if they are present. If there is only one label key in the response, then for the label portion, Grafana displays the value of the label without the enclosing braces. |
| `${__field.name}`            | Same as syntax          | `Temp`                         | Displays the name of the field (without labels).                                                                                                                                                                   |
| `${__field.labels}`          | Same as syntax          | `Loc="PBI", Sensor="3"`        | Displays the labels without the name.                                                                                                                                                                              |
| `${__field.labels.X}`        | `${__field.labels.Loc}` | `PBI`                          | Displays the value of the specified label key.                                                                                                                                                                     |
| `${__field.labels.__values}` | Same as Syntax          | `PBI, 3`                       | Displays the values of the labels separated by a comma (without label keys).                                                                                                                                       |

If the value is an empty string after rendering the expression for a particular field, then the default display method is used.

### Color scheme

The color options and their effect on the visualization depends on the visualization you are working with. Some visualizations have different color options.

You can specify a single color, or select a continuous (gradient) color schemes, based on a value.
Continuous color interpolates a color using the percentage of a value relative to min and max.

Select one of the following palettes:

<div class="clearfix"></div>

| Color mode                           | Description                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single color**                     | Specify a single color, useful in an override rule                                                                                                       |
| **Shades of a color**                | Selects shades of a single color, useful in an override rule                                                                                             |
| **From thresholds**                  | Informs Grafana to take the color from the matching threshold                                                                                            |
| **Classic palette**                  | Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations |
| **Classic palette (by series name)** | Grafana will assign color based on the name of the series. Useful when the series names to be visualized depend on the available data.                   |
| **Green-Yellow-Red (by value)**      | Continuous color scheme                                                                                                                                  |
| **Red-Yellow-Green (by value)**      | Continuous color scheme                                                                                                                                  |
| **Blue-Yellow-Red (by value)**       | Continuous color scheme                                                                                                                                  |
| **Yellow-Red (by value)**            | Continuous color scheme                                                                                                                                  |
| **Blue-Purple (by value)**           | Continuous color scheme                                                                                                                                  |
| **Yellow-Blue (by value)**           | Continuous color scheme                                                                                                                                  |
| **Blues (by value)**                 | Continuous color scheme (panel background to blue)                                                                                                       |
| **Reds (by value)**                  | Continuous color scheme (panel background color to red)                                                                                                  |
| **Greens (by value)**                | Continuous color scheme (panel background color to green)                                                                                                |
| **Purples (by value)**               | Continuous color scheme (panel background color to purple)                                                                                               |

{{< figure src="/static/img/docs/v73/color_scheme_dropdown.png" max-width="350px" caption="Color scheme" >}}

### No value

Enter what Grafana should display if the field value is empty or null. The default value is a hyphen (-).
