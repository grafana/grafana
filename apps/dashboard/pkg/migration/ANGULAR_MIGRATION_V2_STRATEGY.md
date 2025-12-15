# Angular Panel Migration Strategy for V2 Dashboards

## Problem

When dashboards are converted from v1 to v2 schema, Angular panel migrations (e.g., `singlestat` → `stat`) are not correctly applied. This leads to data loss in fields like:

- `unit`
- `mappings`
- `calcs`
- `orientation`
- `colorMode`
- `graphMode`

### Example: Singlestat Panel

**Before migration (v1 - singlestat):**
```json
{
  "type": "singlestat",
  "format": "short",
  "colorBackground": true,
  "sparkline": { "show": true }
}
```

**After v1→v2 conversion (missing migration):**
```json
{
  "vizConfig": {
    "kind": "stat",
    "spec": {
      "options": {},
      "fieldConfig": {
        "defaults": {}
      }
    }
  }
}
```

**Expected (with migration):**
```json
{
  "vizConfig": {
    "kind": "stat",
    "spec": {
      "options": {
        "colorMode": "background",
        "graphMode": "area"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "short"
        }
      }
    }
  }
}
```

---

## Root Cause

The v1→v2 conversion in the backend sets `autoMigrateFrom` on the panel, but:

1. The v2 schema does NOT include `autoMigrateFrom` as a field
2. When the frontend loads a v2 dashboard, it doesn't know the panel needs Angular migration
3. The migration handlers (e.g., `statPanelChangedHandler`) are never called

---

## Solution: `__angularMigration` Temporary Data

### Strategy

1. **Backend (v1→v2):** Store the entire original Angular panel under `options.__angularMigration`
2. **Frontend (v2 load):** Extract `__angularMigration`, delete it from options, and attach a custom migration handler
3. **Migration handler:** Calls `plugin.onPanelTypeChanged()` with the original panel data

### Data Structure

```json
{
  "vizConfig": {
    "kind": "stat",
    "spec": {
      "options": {
        "__angularMigration": {
          "autoMigrateFrom": "singlestat",
          "originalPanel": {
            "type": "singlestat",
            "format": "short",
            "colorBackground": true,
            "sparkline": { "show": true },
            "fieldConfig": { ... },
            "options": { ... }
          }
        }
      }
    }
  }
}
```

---

## Implementation

### 1. Backend: Inject `__angularMigration` (Go)

**File:** `apps/dashboard/pkg/migration/conversion/v1beta1_to_v2alpha1.go`

**Function:** `buildVizConfig()`

```go
func buildVizConfig(panelMap map[string]interface{}) dashv2alpha1.DashboardVizConfigKind {
    // ... existing code ...

    options := make(map[string]interface{})
    if opts, ok := panelMap["options"].(map[string]interface{}); ok {
        for k, v := range opts {
            options[k] = v
        }
    }

    // NEW: Check for autoMigrateFrom and preserve angular migration data
    if autoMigrateFrom, ok := panelMap["autoMigrateFrom"].(string); ok && autoMigrateFrom != "" {
        options["__angularMigration"] = map[string]interface{}{
            "autoMigrateFrom": autoMigrateFrom,
            "originalPanel":   panelMap,  // Keep entire original panel
        }
    }

    // ... rest of function ...
}
```

### 2. Frontend: Extract and Consume `__angularMigration`

**File:** `public/app/features/dashboard-scene/serialization/layoutSerializers/utils.ts`

**Function:** `buildVizPanel()`

```typescript
export function buildVizPanel(panel: PanelKind, id?: number): VizPanel {
  // Extract __angularMigration data if present
  const rawOptions = panel.spec.vizConfig.spec.options ?? {};
  const angularMigration = rawOptions.__angularMigration as AngularMigrationData | undefined;

  // Create clean options without __angularMigration
  const options = { ...rawOptions };
  delete options.__angularMigration;

  const vizPanelState: VizPanelState = {
    // ... existing properties ...
    options,
    fieldConfig: transformMappingsToV1(panel.spec.vizConfig.spec.fieldConfig),
    // ... other properties ...
  };

  // Attach migration handler if needed
  if (angularMigration) {
    vizPanelState._UNSAFE_customMigrationHandler = createV2AngularMigrationHandler(angularMigration);
  }

  return new VizPanel(vizPanelState);
}
```

### 3. Frontend: Migration Handler

**File:** `public/app/features/dashboard-scene/serialization/angularMigration.ts`

```typescript
export interface AngularMigrationData {
  autoMigrateFrom: string;
  originalPanel: Record<string, unknown>;
}

export function createV2AngularMigrationHandler(migrationData: AngularMigrationData) {
  return function handleV2AngularMigration(panel: PanelModel, plugin: PanelPlugin) {
    const { autoMigrateFrom, originalPanel } = migrationData;
    const wasAngular = autoMigrateAngular[autoMigrateFrom] != null;

    if (plugin.onPanelTypeChanged) {
      // Pass original panel as angular data for migration handlers
      const prevOptions = wasAngular 
        ? { angular: originalPanel } 
        : { options: originalPanel };
      
      Object.assign(
        panel.options,
        plugin.onPanelTypeChanged(panel, autoMigrateFrom, prevOptions, panel.fieldConfig)
      );
    }
  };
}
```

### 4. Backend: Restore on v2→v1 Round-trip (Go)

**File:** `apps/dashboard/pkg/migration/conversion/v2alpha1_to_v1beta1.go`

**Function:** `convertPanelKindToV1()`

```go
func convertPanelKindToV1(...) (map[string]interface{}, error) {
    // ... existing conversion logic ...

    // Restore angular migration data if present
    if options, ok := panel["options"].(map[string]interface{}); ok {
        if angularMigration, ok := options["__angularMigration"].(map[string]interface{}); ok {
            // Restore autoMigrateFrom to panel level
            if autoMigrateFrom, ok := angularMigration["autoMigrateFrom"].(string); ok {
                panel["autoMigrateFrom"] = autoMigrateFrom
            }

            // Restore original panel fields
            if originalPanel, ok := angularMigration["originalPanel"].(map[string]interface{}); ok {
                for key, value := range originalPanel {
                    if _, exists := panel[key]; !exists {
                        panel[key] = value
                    }
                }
            }

            // Remove __angularMigration from options
            delete(options, "__angularMigration")
        }
    }
    
    return panel, nil
}
```

---

## How It Works: Singlestat Example

### Step 1: v1 Dashboard with Singlestat

```json
{
  "panels": [{
    "type": "singlestat",
    "autoMigrateFrom": "singlestat",
    "format": "short",
    "colorBackground": true,
    "sparkline": { "show": true },
    "fieldConfig": {
      "defaults": { "unit": "short" }
    }
  }]
}
```

### Step 2: Backend Converts to v2

```json
{
  "spec": {
    "elements": {
      "panel-1": {
        "spec": {
          "vizConfig": {
            "kind": "stat",
            "spec": {
              "options": {
                "__angularMigration": {
                  "autoMigrateFrom": "singlestat",
                  "originalPanel": {
                    "type": "singlestat",
                    "format": "short",
                    "colorBackground": true,
                    "sparkline": { "show": true },
                    "fieldConfig": { "defaults": { "unit": "short" } }
                  }
                }
              },
              "fieldConfig": { "defaults": {} }
            }
          }
        }
      }
    }
  }
}
```

### Step 3: Frontend Loads v2 Dashboard

1. `buildVizPanel()` extracts `__angularMigration`
2. Deletes `__angularMigration` from options
3. Attaches `_UNSAFE_customMigrationHandler`

### Step 4: Plugin Loads and Migration Runs

1. VizPanel activates → plugin loads
2. `_UNSAFE_customMigrationHandler` is called
3. `plugin.onPanelTypeChanged()` receives `{ angular: originalPanel }`
4. `statPanelChangedHandler` (in `@grafana/ui`) processes the migration:
   - Converts `format: "short"` → `fieldConfig.defaults.unit: "short"`
   - Converts `colorBackground: true` → `options.colorMode: "background"`
   - Converts `sparkline.show: true` → `options.graphMode: "area"`

### Step 5: Final Panel State

```json
{
  "options": {
    "colorMode": "background",
    "graphMode": "area",
    "reduceOptions": { "calcs": ["lastNotNull"] }
  },
  "fieldConfig": {
    "defaults": {
      "unit": "short"
    }
  }
}
```

---

## Why This Approach?

### Benefits

1. **No v2 schema changes** - `__angularMigration` is stored in the untyped `options` map
2. **Complete data preservation** - Entire original panel is kept, no risk of missing fields
3. **Reuses existing handlers** - `sharedSingleStatPanelChangedHandler` and others work unchanged
4. **Temporary data** - Removed from options after extraction, not persisted
5. **Round-trip safe** - v2→v1 conversion restores original data

### Supported Migrations

| Original Panel | Target Panel | Migration Handler |
|---------------|--------------|-------------------|
| `singlestat` | `stat` | `statPanelChangedHandler` |
| `graph` | `timeseries` | `graphPanelChangedHandler` |
| `table-old` | `table` | `tablePanelChangedHandler` |

---

## Files Modified

| File | Purpose |
|------|---------|
| `apps/dashboard/pkg/migration/conversion/v1beta1_to_v2alpha1.go` | Inject `__angularMigration` |
| `apps/dashboard/pkg/migration/conversion/v2alpha1_to_v1beta1.go` | Restore on round-trip |
| `public/app/features/dashboard-scene/serialization/layoutSerializers/utils.ts` | Extract and consume |
| `public/app/features/dashboard-scene/serialization/angularMigration.ts` | Migration handler factory |

---

## Testing

### Unit Tests

- Verify `__angularMigration` is injected for panels with `autoMigrateFrom`
- Verify `createV2AngularMigrationHandler` calls `plugin.onPanelTypeChanged` correctly
- Verify round-trip conversion preserves data

### Integration Tests

- Load v1 dashboard with singlestat → verify stat panel has correct options/fieldConfig
- Load v1 dashboard with graph → verify timeseries panel has correct options/fieldConfig

---

## Related Links

- GitHub Issue: https://github.com/grafana/grafana/issues/115315
- Migration README: `apps/dashboard/pkg/migration/README.md`
- Stat Migration: `public/app/plugins/panel/stat/StatMigrations.ts`
- Shared Handler: `packages/grafana-ui/src/components/BigValue/sharedSingleStatMigrations.ts`

---

## Date

Strategy documented: December 2024

