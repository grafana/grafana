# Barchart Markers Feature

This feature adds support for displaying markers on individual bars in a barchart panel. Markers allow you to visualize threshold values or target values for each bar, making it easy to compare actual values against expected values.

## Overview

The markers feature addresses the limitation of global thresholds by allowing you to set different threshold values for each bar based on data from your time series. This is particularly useful when:

- Each bar represents a different entity with its own limits (e.g., different servers with different capacity limits)
- You want to compare current values against dynamic thresholds
- You need to visualize multiple threshold types on the same chart

## Configuration

### Adding Markers

1. Open the barchart panel editor
2. Navigate to the "Markers" section in the panel options
3. Click "Add Marker" to create a new marker configuration
4. Configure the marker properties:

### Marker Properties

#### Field
- **Description**: Select the field from your data that contains the marker values
- **Required**: Yes
- **Example**: If you have a field called "max_capacity", select it to show capacity thresholds

#### Shape
- **Description**: The visual shape of the marker
- **Options**: 
  - Circle (default)
  - Square
  - Diamond
  - Triangle
- **Default**: Circle

#### Color
- **Description**: The color of the marker
- **Default**: Red (#e74c3c)
- **Format**: Hex color code or color name

#### Size
- **Description**: Size of the marker in pixels
- **Range**: 2-20 pixels
- **Default**: 6 pixels

#### Show Value
- **Description**: Whether to display the marker value as a label next to the marker
- **Default**: false

## Data Requirements

For markers to work properly, your data must include:

1. **Primary data field**: The values for your bars (e.g., current usage)
2. **Marker data field**: The threshold/target values for each bar (e.g., maximum capacity)

### Example Data Structure

```json
{
  "fields": [
    {
      "name": "Server",
      "type": "string",
      "values": ["Server-A", "Server-B", "Server-C"]
    },
    {
      "name": "CPU Usage",
      "type": "number", 
      "values": [75, 45, 90]
    },
    {
      "name": "CPU Limit",
      "type": "number",
      "values": [80, 60, 95]
    }
  ]
}
```

In this example:
- "CPU Usage" would be displayed as bars
- "CPU Limit" could be configured as markers to show the threshold for each server

## Use Cases

### Server Monitoring
Monitor server metrics against their individual capacity limits:
- **Bars**: Current CPU usage per server
- **Markers**: CPU limit per server (different for each server type)

### Sales Targets
Track sales performance against individual targets:
- **Bars**: Actual sales per region/salesperson
- **Markers**: Sales targets per region/salesperson

### Quality Control
Monitor measurements against acceptable ranges:
- **Bars**: Actual measurements
- **Markers**: Upper/lower control limits

## Best Practices

1. **Choose appropriate marker shapes**: Use different shapes to represent different types of thresholds
2. **Use consistent colors**: Use color coding to group related markers (e.g., red for limits, yellow for warnings)
3. **Limit marker count**: Too many markers can clutter the visualization
4. **Consider marker size**: Ensure markers are visible but don't overshadow the data
5. **Use value labels sparingly**: Only show values when the exact number is important

## Troubleshooting

### Markers not appearing
- Verify that the selected field contains numeric data
- Check that the field name matches exactly (case-sensitive)
- Ensure marker values are not null for the data points

### Markers in wrong position
- Verify that your data is properly aligned (same number of values in all fields)
- Check that the marker field contains the expected values

### Performance issues
- Limit the number of markers per chart
- Reduce marker size if rendering is slow
- Consider disabling value labels for better performance

## Implementation Details

The markers feature integrates with Grafana's existing barchart panel by:

1. **Data Processing**: Extracts marker values from selected fields during data preparation
2. **Rendering**: Uses HTML5 Canvas to draw markers on top of bars during the chart draw cycle
3. **Configuration**: Extends the panel options schema to include marker settings
4. **Validation**: Ensures marker configurations are valid and provides helpful error messages

The implementation maintains backward compatibility - existing barchart panels will continue to work without any changes.