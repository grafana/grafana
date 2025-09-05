# Frontend Plugin Migration Workflow

This document describes the complete workflow of how plugin migrations work in the Grafana frontend, using the v28 singlestat to stat panel migration as a concrete example.

## Overview

Plugin migrations in Grafana follow a multi-stage process that transforms old panel configurations into new formats. The migration happens in several phases:

1. **Dashboard Schema Migration** - Initial migration step in `DashboardMigrator`
2. **Panel Model Auto-Migration** - Automatic migration in `PanelModel` constructor
3. **Plugin Change Processing** - Complete transformation via `changePlugin()`
4. **Plugin-Specific Migration** - Detailed migration in plugin-specific handlers

## Detailed Workflow

### 1. Dashboard Schema Migration (`DashboardMigrator.ts`)

The migration starts in the `DashboardMigrator.updateSchema()` method when a dashboard is loaded with an older schema version.

```typescript
// In DashboardMigrator.ts (lines 685-711)
if (oldVersion < 28 && finalTargetVersion >= 28) {
  panelUpgrades.push((panel: PanelModel) => {
    if (panel.type === 'singlestat') {
      return migrateSinglestat(panel);
    }
    return panel;
  });
}
```

**Key Points:**

- This is the **minimal initial migration step**
- It only sets up the panel for further processing
- The actual transformation happens later in the workflow

### 2. Panel Model Auto-Migration (`PanelModel.ts`)

When a `PanelModel` is constructed, it automatically checks for panels that need migration:

```typescript
// In PanelModel.ts constructor
const autoMigrateAngular: Record<string, string> = {
  singlestat: 'stat',
  'grafana-singlestat-panel': 'stat',
  table: 'table-old',
};

// Auto-migration happens in constructor
if (autoMigrateAngular[this.type]) {
  this.autoMigrateFrom = this.type;
  this.type = autoMigrateAngular[this.type];
}
```

**Key Points:**

- This happens **before** the `DashboardMigrator` runs
- Sets `autoMigrateFrom` property to track original type
- Changes panel type to the new type
- This is a **minimal transformation** - just type change

### 3. Plugin Change Processing (`PanelModel.changePlugin()`)

The main transformation happens when `changePlugin()` is called:

```typescript
// In PanelModel.ts (lines 507-534)
changePlugin(newPlugin: PanelPlugin) {
  const pluginId = newPlugin.meta.id;
  const oldOptions = this.getOptionsToRemember();
  const prevFieldConfig = this.fieldConfig;
  const oldPluginId = this.type;
  const wasAngular = this.isAngularPlugin() || Boolean(autoMigrateAngular[oldPluginId]);

  // Store old options for migration
  this.cachedPluginOptions[oldPluginId] = {
    properties: oldOptions,
    fieldConfig: prevFieldConfig,
  };

  // Clear old properties
  this.clearPropertiesBeforePluginChange();

  // Restore panel options for new plugin
  this.restorePanelOptions(pluginId);

  // Call plugin-specific migration handler
  this.callPanelTypeChangeHandler(newPlugin, oldPluginId, oldOptions, wasAngular);

  // Switch to new plugin
  this.type = pluginId;
  this.plugin = newPlugin;
  this.configRev++;

  // Apply plugin defaults
  this.applyPluginOptionDefaults(newPlugin, true);
}
```

**Key Steps:**

1. **Store old options** - Preserves original configuration
2. **Clear old properties** - Removes deprecated properties
3. **Restore panel options** - Sets up new plugin structure
4. **Call migration handler** - Plugin-specific transformation
5. **Switch plugin** - Updates type and plugin reference
6. **Apply defaults** - Sets up default options

### 4. Plugin-Specific Migration Handlers

Each plugin has its own migration handler that performs the detailed transformation:

#### Stat Panel Migration (`StatMigrations.ts`)

```typescript
// In StatMigrations.ts (lines 8-47)
export const statPanelChangedHandler = (
  panel: PanelModel<Partial<Options>>,
  prevPluginId: string,
  prevOptions: any
) => {
  // This handles most config changes
  const options: Options = sharedSingleStatPanelChangedHandler(panel, prevPluginId, prevOptions);

  // Changing from angular singlestat
  if (prevOptions.angular && (prevPluginId === 'singlestat' || prevPluginId === 'grafana-singlestat-panel')) {
    const oldOptions = prevOptions.angular;

    // Handle graph mode
    options.graphMode = BigValueGraphMode.None;
    if (oldOptions.sparkline && oldOptions.sparkline.show) {
      options.graphMode = BigValueGraphMode.Area;
    }

    // Handle color modes
    if (oldOptions.colorBackground) {
      options.colorMode = BigValueColorMode.Background;
    } else if (oldOptions.colorValue) {
      options.colorMode = BigValueColorMode.Value;
    } else {
      options.colorMode = BigValueColorMode.None;
    }

    // Handle text mode
    if (oldOptions.valueName === 'name') {
      options.textMode = BigValueTextMode.Name;
    }
  }

  return options;
};
```

#### Shared Single Stat Migration (`SingleStatBaseOptions.ts`)

The detailed transformation happens in `sharedSingleStatPanelChangedHandler`:

```typescript
// In SingleStatBaseOptions.ts (lines 117-186)
function migrateFromAngularSinglestat(panel: PanelModel, prevOptions: any) {
  const prevPanel = prevOptions.angular;
  const reducer = fieldReducers.getIfExists(prevPanel.valueName);

  // Set up basic options
  const options: SingleStatBaseOptions = {
    reduceOptions: {
      calcs: [reducer ? reducer.id : ReducerID.mean],
    },
    orientation: VizOrientation.Horizontal,
  };

  const defaults: FieldConfig = {};

  // Migrate format
  if (prevPanel.format) {
    defaults.unit = prevPanel.format;
  }

  // Migrate thresholds and colors
  if (prevPanel.thresholds && prevPanel.colors) {
    const levels = prevPanel.thresholds.split(',').map((strValue: string) => {
      return Number(strValue.trim());
    });

    // One more color than threshold
    const thresholds: Threshold[] = [];
    for (const color of prevPanel.colors) {
      const idx = thresholds.length - 1;
      if (idx >= 0) {
        thresholds.push({ value: levels[idx], color });
      } else {
        thresholds.push({ value: -Infinity, color }); // Becomes null in JSON
      }
    }

    defaults.thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: thresholds,
    };
  }

  // Convert value mappings
  const mappings = convertOldAngularValueMappings(prevPanel, defaults.thresholds);
  if (mappings && mappings.length) {
    defaults.mappings = mappings;
  }

  panel.fieldConfig.defaults = defaults;
  return options;
}
```

## Migration Flow Diagram

```
Dashboard Load
     ↓
PanelModel Constructor
     ↓
Auto-Migration Check
     ↓
Set autoMigrateFrom + Change Type
     ↓
DashboardMigrator.updateSchema()
     ↓
migrateSinglestat() - Minimal Setup
     ↓
panel.changePlugin(statPanelPlugin)
     ↓
Store Old Options
     ↓
Clear Old Properties
     ↓
callPanelTypeChangeHandler()
     ↓
statPanelChangedHandler()
     ↓
sharedSingleStatPanelChangedHandler()
     ↓
migrateFromAngularSinglestat()
     ↓
Convert Thresholds & Value Mappings
     ↓
Apply Plugin Defaults
     ↓
Complete Migration
```

## Key Properties and Their Transformations

### Thresholds Migration

- **Input**: `"10,20,30"` (string) + `["#FF0000", "green", "orange"]` (colors)
- **Output**:
  ```json
  {
    "mode": "absolute",
    "steps": [
      { "value": null, "color": "#FF0000" },
      { "value": 10, "color": "green" },
      { "value": 20, "color": "orange" }
    ]
  }
  ```

### Value Mappings Migration

- **Input**: Old `valueMaps` array
- **Output**: New `mappings` array with color from thresholds

### Options Migration

- **Input**: Angular panel options
- **Output**: Modern stat panel options with proper defaults

## Important Notes

1. **Two-Phase Migration**: The migration happens in two phases:
   - **Phase 1**: Minimal setup (auto-migration + DashboardMigrator)
   - **Phase 2**: Complete transformation (changePlugin + plugin handlers)

2. **Property Cleanup**: Old properties are explicitly removed to prevent conflicts

3. **Color Inheritance**: Value mapping colors are inherited from threshold colors

4. **Null Value Handling**: `-Infinity` values become `null` in JSON serialization

5. **Plugin Versioning**: Plugin versions are set during migration for compatibility

## Testing the Migration

The migration is tested using the `DashboardMigratorSingleVersion.test.ts` which:

1. Loads a dashboard with old schema version
2. Runs frontend migration
3. Compares with backend migration output
4. Ensures both produce identical results

This ensures that frontend and backend migrations stay in sync and produce consistent results.
