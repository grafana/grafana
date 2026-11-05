# Query Editor Header Actions

This document describes the architecture and behavior of action buttons in the query editor header.

## Overview

The query editor header displays different actions based on the type of card being edited:

- **Query** - Data source queries (e.g., Prometheus, Loki)
- **Expression** - Mathematical expressions that process query results
- **Transformation** - Data transformations applied to query results

## Action Visibility Matrix

| Action                | Query | Expression | Transformation | Notes                                         |
| --------------------- | ----- | ---------- | -------------- | --------------------------------------------- |
| Warning Badges        | ✓     | ✓          | -              | Shows data warnings/info from results         |
| Save Button           | ✓     | -          | -              | Query library (not for expressions)           |
| Plugin Actions        | ✓     | -          | -              | Icon buttons provided by plugins (see below)  |
| Hide / Disable        | ✓     | ✓          | ✓              | Hide for queries, disable for transformations |
| Remove                | ✓     | ✓          | ✓              | Asks for confirmation                         |
| Experimental Feedback | ✓     | ✓          | ✓              | Single view only; stacked view has it once    |
| Query Actions Menu    | ✓     | ✓          | -              | Dropdown, see below                           |
| Transformation Help   | -     | -          | ✓              | Opens the transformation help drawer          |
| Transformation Filter | -     | -          | ✓              | Shown when there is data or a filter is set   |
| Transformation Debug  | -     | -          | ✓              | Opens the input/output debug drawer           |

**Note:** A Run Query button is NOT in the header. Query execution is controlled by the datasource's own query editor component. The query inspector lives in the footer.

## Query Actions Menu Contents

### For Queries

1. **Duplicate query** - Creates a copy with a new refId
2. **Show/Hide data source help** - Toggles data source-specific help panel (if datasource provides `QueryEditorHelp` component)

**Query Library Editing Mode:** When editing a query from the query library (`isEditingQuery` is true), the Save button is hidden.

### For Expressions

1. **Duplicate expression** - Creates a copy with a new refId

**Note:** Expressions do NOT show:

- Query library save button (expressions can't be saved to library)
- Data source help (expressions don't have data sources)
- Plugin actions

## Architecture

### Component Structure

```
Header/
├── ContentHeader.tsx                # Header layout: type, data source picker, name, actions
├── HeaderActions.tsx                # Action buttons container
├── headerActionTarget.ts            # The card the actions act on
├── EditableQueryName.tsx            # Query name editor
├── TransformationIdentifier.tsx     # Transformation name, editable when it sets a refId
├── WarningBadges.tsx                # Warning/info badges
├── SaveButton.tsx                   # Query library button (library-mode aware)
├── PluginActions.tsx                # Plugin-provided icon buttons
├── QueryActionsMenu.tsx             # Dropdown menu for queries and expressions
├── TransformationActionButtons.tsx  # Help, filter, and debug buttons
├── ExperimentalFeedbackButton.tsx   # Feedback and back-to-classic menu
└── DatasourceHelpPanel.tsx          # Data source help panel component
```

`ContentHeader` and `HeaderActions` act on the selected card by default. The stacked view renders `ContentHeader` for every item with an explicit `target` and `variant="stacked"`, so each stacked header shows and acts on its own query or transformation. Actions that open help or debug views select their target first, because those views only render for the selected card.

### Plugin Extensibility

Plugin actions render as icon buttons in the header, not inside the Query Actions Menu.

**Extra Actions:** Plugins can inject custom actions via the `RowActionComponents` registry:

- `RowActionComponents.getAllExtraRenderAction()` - Actions for all apps
- `RowActionComponents.getScopedExtraRenderAction(app)` - Actions scoped to specific apps (e.g., UnifiedAlerting)

**Adaptive Telemetry:** Plugins can register telemetry actions via the `PluginExtensionPoints.QueryEditorRowAdaptiveTelemetryV1` extension point.

**Extension Actions:** Query editor row extension actions from `useQueryEditorRowExtensionActions`.
