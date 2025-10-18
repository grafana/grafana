# Plugin Dependency Graph Panel

A Grafana panel plugin that visualizes dependencies between Grafana plugins, specifically focusing on extension relationships where one plugin extends another.

## Features

- **Extension Relationship Visualization**: Displays provider-consumer relationships between plugins
- **Interactive Graph**: Drag nodes, multiple layout options (force-directed, hierarchical, circular)
- **Customizable Appearance**: Configure node sizes, colors, and labels
- **Real-time Data Processing**: Processes Grafana table data to create dependency graphs
- **Sample Data**: Includes sample data for testing when no data source is available

## Data Format

The panel expects table data with the following structure:

| Field Name       | Type   | Description                               |
| ---------------- | ------ | ----------------------------------------- |
| `from_app`       | string | Content provider plugin ID                |
| `to_app`         | string | Plugin that defines the extension point   |
| `relation`       | string | Type of relationship ("extends")          |
| `extension_id`   | string | Specific extension point ID               |
| `extension_type` | string | Type of extension ("link" or "component") |

### Example Data

```json
{
  "from_app": ["grafana-asserts-app", "grafana-asserts-app", "grafana-asserts-app", "grafana-asserts-app"],
  "relation": ["extends", "extends", "extends", "extends"],
  "to_app": ["grafana", "grafana", "grafana-assistant-app", "grafana-assistant-app"],
  "extension_id": [
    "grafana/alerting/home",
    "link nav-landing-page/nav-id-observability/v1",
    "navigateToDrilldown/v1",
    "alertingrule/queryeditor"
  ],
  "extension_type": ["link", "link", "link", "component"]
}
```

## Panel Configuration

### Visualization Options

- **Node Size**: Size of plugin nodes (10-100px)
- **Link Distance**: Distance between connected nodes (50-300px)
- **Node Repulsion**: Force that pushes nodes apart (-500 to -50)
- **Show Labels**: Display plugin names and types
- **Show Dependency Types**: Display relationship types on connections
- **Layout Type**: Choose between force-directed, hierarchical, or circular layouts
- **Enable Drag**: Allow repositioning nodes by dragging
- **Enable Zoom**: Allow zooming and panning (future feature)

### Color Options

- **App Plugin Color**: Color for app-type plugins (default: blue)
- **Panel Plugin Color**: Color for panel-type plugins (default: orange)
- **Data Source Plugin Color**: Color for datasource-type plugins (default: green)

### Data Mapping

Configure which columns contain the required data:

- **Source Column**: Column with extending plugin ID (default: `from_app`)
- **Target Column**: Column with extended plugin ID (default: `to_app`)
- **Relation Type Column**: Column with relationship type (default: `relation`)
- **Plugin Name Column**: Column with display names (default: `from_app`)
- **Plugin Type Column**: Column with plugin types (default: `plugin_type`)

## Usage

1. **Add Panel**: Add a new panel to your dashboard and select "Plugin Dependency Graph"

2. **Configure Data Source**: Set up a data source that returns plugin relationship data in the expected format

3. **Test with Sample Data**: If no data source is available, the panel will automatically show sample data demonstrating extension relationships

4. **Customize Appearance**: Use the panel options to adjust colors, layout, and visualization preferences

5. **Interact with Graph**:
   - Drag nodes to reposition them (if enabled)
   - Hover over connections to see relationship details
   - View plugin names and types as labels

## Extension Points Visualization

The panel visualizes the relationship between content provider apps and the extension points they provide content to:

### Visual Layout

**Left Side - Content Providers:**

- **App Boxes**: Rectangular containers showing the full plugin ID (e.g., `grafana-extensionexample1-app`)
- **Role Label**: "Content Provider" indicating these apps provide content to extension points
- **Blue Color**: Consistent color coding for content provider apps

**Right Side - Extension Points:**

- **Grouped by Defining Plugin**: Extension points are grouped in larger containers by the plugin that defines them
- **Plugin Headers**: Show the display name of the plugin that defines the extension points (e.g., "Extensions Test App")
- **Extension Point Boxes**: Individual green boxes showing the extension point names (e.g., "actions", "use-plugin-links/v1")
- **Hierarchical Organization**: Clear visual separation between different defining plugins

### Connection Flow

- **Curved Arrows**: Flow from content provider apps (left) to specific extension points (right)
- **Connection Labels**: "provides content" labels on hover showing the relationship
- **Multiple Connections**: One app can provide content to multiple extension points

### Data Processing

The panel automatically:

1. **Processes Extension Records**: Each row represents one extension relationship with specific extension point ID and type
2. **Identifies Defining Plugins**: Maps "grafana" to "Grafana Core" and other plugin names to their display names
3. **Groups Extension Points**: Organizes extension points by their defining plugin for cleaner visualization
4. **Type-based Styling**: Colors extension points based on type (green for links, orange for components)
5. **Filters Content Providers**: Shows only apps that actually provide content to extension points

### Example

For the data:

```
from_app: "grafana-asserts-app"
relation: "extends"
to_app: "grafana"
extension_id: "grafana/alerting/home"
extension_type: "link"
```

The visualization shows:

- **Left**: `grafana-asserts-app` box labeled "Content Provider"
- **Right**: Extension point "grafana/alerting/home" with "LINK" badge grouped under "Grafana Core"
- **Arrow**: Curved arrow from the provider app to the extension point

### Extension Types

- **Link Extensions** (green boxes with "LINK" badge): Navigation links, menu items, toolbar actions
- **Component Extensions** (orange boxes with "COMPONENT" badge): React components, query editors, custom UI elements

## Development

The panel is built with:

- React and TypeScript
- SVG-based visualization (custom implementation)
- Grafana plugin SDK
- CSS-in-JS styling with Emotion

### Key Components

- `PluginDependencyGraphPanel`: Main panel component
- `DependencyGraph`: SVG visualization component
- `dataProcessor`: Transforms Grafana table data into graph format
- `types`: TypeScript interfaces for data structures
