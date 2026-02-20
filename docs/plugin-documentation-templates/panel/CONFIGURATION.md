# Configuration

This guide explains how to configure [plugin name].

## Prerequisites

Before you configure the plugin, ensure you have:

- [Plugin name] installed in Grafana
- A dashboard where you want to add the panel
- A data source configured and accessible

## Add the panel to a dashboard

To add [plugin name] to a dashboard:

1. Navigate to your dashboard or create a new one.
1. Click **Add** > **Visualization**.
1. Select your data source from the dropdown.
1. In the visualization picker on the right, search for "[plugin name]" and select it.

## Configure data source

Configure the data source query to return the data your panel needs:

1. In the **Query** tab, build your query using the data source query editor.
1. Refer to [Data requirements](DATA-REQUIREMENTS.md) for information about the expected data format.

## Configure panel options

Panel options let you customize the panel's title, description, and links.

### Panel options

| Option | Description |
| ------ | ----------- |
| **Title** | Set the panel title. |
| **Description** | Add a description for the panel. The description appears in a tooltip when you hover over the info icon in the panel header. |
| **Transparent background** | Make the panel background transparent. |
| **Panel links** | Add links to other dashboards or external resources. |

## Configure visualization options

[Plugin name] provides the following configuration options.

### [Option category 1]

[Brief description of the option category.]

| Option | Description |
| ------ | ----------- |
| **[Option name]** | [Description of what the option does and available values.] |
| **[Option name]** | [Description of what the option does and available values.] |

### [Option category 2]

[Brief description of the option category.]

| Option | Description |
| ------ | ----------- |
| **[Option name]** | [Description of what the option does and available values.] |
| **[Option name]** | [Description of what the option does and available values.] |

### Value options

Use the following options to refine how the visualization displays values:

| Option | Description |
| ------ | ----------- |
| **Show** | Choose how to display data. Options:<ul><li>**Calculate** - Show a calculated value based on all rows.</li><li>**All values** - Show a separate stat for every row.</li></ul> |
| **Calculation** | Select a reducer function to calculate a single value from multiple rows. Available when **Show** is set to **Calculate**. |
| **Limit** | Set the maximum number of rows to display. Available when **Show** is set to **All values**. |
| **Fields** | Select which fields to display in the panel. |

## Configure standard options

Standard options are available for all visualizations and allow you to customize how field values are displayed.

### Common standard options

| Option | Description |
| ------ | ----------- |
| **Unit** | Choose the unit for field values. |
| **Min** | Set the minimum value for the axis or gauge. |
| **Max** | Set the maximum value for the axis or gauge. |
| **Decimals** | Specify the number of decimal places to display. |
| **Display name** | Set a custom display name for the field. |
| **Color scheme** | Choose a color scheme for the visualization. |
| **No value** | Define what to display when there's no data. |

For a complete list of standard options, refer to [Configure standard options](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/).

## Configure value mappings

Value mappings allow you to translate field values into text or colors.

To add a value mapping:

1. In the panel editor, navigate to the **Value mappings** section.
1. Click **Add value mapping**.
1. Choose a mapping type:
   - **Value** - Map a specific value to text and color.
   - **Range** - Map a range of values to text and color.
   - **Regex** - Map values matching a regex pattern to text and color.
   - **Special** - Map special values like null or NaN.

For more information, refer to [Configure value mappings](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-value-mappings/).

## Configure thresholds

Thresholds allow you to change the color of field values based on their value.

To configure thresholds:

1. In the panel editor, navigate to the **Thresholds** section.
1. Choose a threshold mode:
   - **Absolute** - Define thresholds using absolute values.
   - **Percentage** - Define thresholds using percentage values.
1. Click **Add threshold** to add additional thresholds.
1. Set values and colors for each threshold.

For more information, refer to [Configure thresholds](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-thresholds/).

## Configure overrides

Field overrides allow you to customize the visualization for specific fields or series.

To add a field override:

1. In the panel editor, navigate to the **Overrides** section.
1. Click **Add field override**.
1. Select fields to override:
   - Fields with name
   - Fields with name matching regex
   - Fields with type
   - Fields returned by query
1. Click **Add override property** and select the properties to override.

For more information, refer to [Configure overrides](https://grafana.com/docs/grafana/latest/panels-visualizations/configure-overrides/).

## Save the dashboard

After configuring the panel:

1. Click **Apply** to save the panel configuration.
1. Click the save icon at the top of the dashboard.
1. Add a descriptive name for the dashboard.
1. Click **Save**.

## Next steps

- [Learn about data requirements](DATA-REQUIREMENTS.md)
- [Troubleshoot common issues](TROUBLESHOOTING.md)
- [View examples and use cases](README.md)
