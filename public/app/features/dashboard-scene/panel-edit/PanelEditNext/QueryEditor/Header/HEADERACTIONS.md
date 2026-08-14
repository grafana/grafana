# Query Editor Header Actions

This document describes the architecture and behavior of action buttons in the query editor header.

## Overview

The query editor header displays different actions based on the type of card being edited:

- **Query** - Data source queries (e.g., Prometheus, Loki)
- **Expression** - Mathematical expressions that process query results
- **Transformation** - Data transformations applied to query results

## Action Visibility Matrix

| Action           | Query | Expression | Transformation | Notes                                 |
| ---------------- | ----- | ---------- | -------------- | ------------------------------------- |
| Warning Badges   | ✓     | ✓          | -              | Shows data warnings/info from results |
| Save Button      | ✓     | -          | -              | Query library (not for expressions)   |
| Inspector Button | ✓     | ✓          | ✓              | Always visible                        |
| Actions Menu     | ✓     | ✓          | ✓              | Content varies by type (see below)    |

**Note:** A Run Query button is NOT in the header. Query execution is controlled by the datasource's own query editor component.

## Actions Menu Dropdown Contents

### For Queries

1. **Duplicate query** - Creates a copy with a new refId
2. **Hide/Show response** - Toggles query visibility in results
3. **Extra plugin actions** - Dynamic actions from data source plugins via `RowActionComponents` (if any)
4. **Adaptive telemetry actions** - Plugin extensions from `PluginExtensionPoints.QueryEditorRowAdaptiveTelemetryV1` (if any)
5. **Show/Hide data source help** - Toggles data source-specific help panel (if datasource provides `QueryEditorHelp` component)
6. **Remove query** - Deletes the query

**Query Library Editing Mode:** When editing a query from the query library (`isEditingQuery` is true), the Save, Duplicate, and Remove actions are hidden to prevent modification of the library query.

### For Expressions

1. **Duplicate query** - Creates a copy with a new refId
2. **Hide/Show response** - Toggles expression visibility in results
3. **Extra plugin actions** - Dynamic actions from plugins via `RowActionComponents` (if any)
4. **Adaptive telemetry actions** - Plugin extensions (if any)
5. **Remove query** - Deletes the expression

**Note:** Expressions do NOT show:

- Query library save button (expressions can't be saved to library)
- Data source help (expressions don't have data sources)

### For Transformations (Scaffold Only)

1. **Placeholder message** - "Transformation actions coming soon"
2. **Remove transformation** - Deletes the transformation

**Note:** Full transformation actions (Help, Filter, Debug, Disable) will be implemented in a future iteration.

## Architecture

### Component Structure

```
Header/
├── ContentHeader.tsx           # Main orchestrator
├── HeaderActions.tsx           # Action buttons container
├── EditableQueryName.tsx       # Query name editor
├── ActionsMenu.tsx             # Dropdown menu (type-aware, plugin-extensible)
├── WarningBadges.tsx           # Warning/info badges (type-aware)
├── SaveButton.tsx              # Query library button (type-aware, library-mode aware)
├── InspectorButton.tsx         # Query inspector button
└── DatasourceHelpPanel.tsx     # Data source help panel component
```

### Plugin Extensibility

**Extra Actions:** Plugins can inject custom actions into the Actions Menu via the `RowActionComponents` registry:

- `RowActionComponents.getAllExtraRenderAction()` - Actions for all apps
- `RowActionComponents.getScopedExtraRenderAction(app)` - Actions scoped to specific apps (e.g., UnifiedAlerting)

**Adaptive Telemetry:** Plugins can register telemetry actions via the `PluginExtensionPoints.QueryEditorRowAdaptiveTelemetryV1` extension point. These appear in the Actions Menu dropdown.
