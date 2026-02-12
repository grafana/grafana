# Dashboard rules -- comprehensive work summary

This document describes the complete body of work on the `dashboard-rules` branch in `/Users/dominik/Projects/worktrees/dashboard-rules`. It is intended to give another agent full context to continue or review this work.

## Branch status

- **Branch**: `dashboard-rules` (git worktree at `/Users/dominik/Projects/worktrees/dashboard-rules`)
- **Base**: rebased on `origin/main` as of 2026-02-12
- **Commits**: 17 committed + uncommitted working tree changes
- **Changeset**: 34 files changed, +5,203 / -220 lines
- **Feature toggle**: `dashboardRules` (must be enabled in `custom.ini`)

## What this feature does

Dashboard rules let a single dashboard adapt its content based on runtime context -- who is viewing it, what time range is selected, or what variable values are set. Instead of duplicating dashboards for different audiences, rules dynamically show/hide panels, collapse rows, change refresh intervals, or swap queries.

A rule consists of:
- **Targets**: one or more panels, rows, or tabs the rule applies to (via `ElementReference` or `LayoutItemReference`)
- **Conditions**: predicates that determine when the rule activates (variable value, time range size, user team membership, data presence)
- **Match mode**: `and` or `or` -- how multiple conditions combine
- **Outcomes**: what happens when the rule is active (visibility, collapse, refresh interval, query override)

Rules are evaluated reactively. When conditions stop being met, outcomes revert automatically. Last matching rule wins when multiple rules target the same element.

## Architecture

### Schema layer (CUE + codegen)

Files modified:
- `apps/dashboard/kinds/v2alpha1/dashboard_spec.cue`
- `apps/dashboard/kinds/v2beta1/dashboard_spec.cue`
- `apps/dashboard/pkg/apis/dashboard/v2alpha1/dashboard_spec.cue`
- `apps/dashboard/pkg/apis/dashboard/v2beta1/dashboard_spec.cue`
- Generated Go types: `dashboard_spec_gen.go`, `zz_generated.openapi.go` (both v2alpha1 and v2beta1)
- Generated TS types: `packages/grafana-schema/src/schema/dashboard/v2*/types.spec.gen.ts`
- Conversion functions: `v2alpha1_to_v2beta1.go`, `v2beta1_to_v2alpha1.go`

Key schema types added:
- `DashboardRule` -- top-level rule container with name, targets, conditions (match + items), and outcomes array
- `ConditionalRenderingUserTeamKind` -- condition checking team membership
- `DashboardRuleOutcomeCollapseKind` -- collapse/expand rows
- `DashboardRuleOutcomeRefreshIntervalKind` -- override refresh interval
- `DashboardRuleOutcomeOverrideQueryKind` -- swap panel queries
- `LayoutItemReference` -- reference to rows/tabs by name (alongside existing `ElementReference` for panels)

### Frontend runtime (Grafana Scenes)

#### Core SceneObjects

`public/app/features/dashboard-scene/conditional-rendering/`

- **`DashboardRule`** (`rules/DashboardRule.ts`): SceneObject representing a single rule. Holds targets, conditions (as child SceneObjects), match mode, outcomes (as schema kind types), and computed `active` state. Evaluates conditions reactively and publishes state changes.

- **`DashboardRules`** (`rules/DashboardRules.ts`): SceneObject holding the full rules array. Subscribes to each rule's active state changes and recomputes derived state maps:
  - `hiddenTargets: Record<string, boolean>` -- visibility per target
  - `collapsedTargets: Record<string, boolean>` -- collapse per target
  - `refreshIntervalOverride: string | undefined` -- dashboard-global refresh override
  - Query overrides: tracks original queries and applies/reverts `SceneQueryRunner` mutations

  Last matching active rule wins for each target. The `_recomputeOutcomes()` method iterates rules in array order.

- **`DashboardScene`** integration (`scene/DashboardScene.tsx`): Activates `DashboardRules` in the scene's `_onActivate` lifecycle. Deactivates on unmount.

#### Registry pattern

Both conditions and outcomes use a registry pattern for extensibility:

**Condition registry** (`conditions/conditionRegistry.ts`):
```typescript
interface ConditionRegistryItem extends RegistryItem {
  deserialize(model: ConditionalRenderingConditionsKindTypes): ConditionalRenderingConditions;
  createEmpty(scene: SceneObject): ConditionalRenderingConditions;
  requiresRenderHidden?: boolean;
  isApplicable?: (objectType: ObjectsWithConditionalRendering) => boolean;
}
```

Registered condition types:
- `ConditionalRenderingVariable` -- variable value checks (=, !=, =~, !~)
- `ConditionalRenderingData` -- panel has/hasn't data
- `ConditionalRenderingTimeRangeSize` -- time range <= threshold (e.g. "1h", "5m")
- `ConditionalRenderingUserTeam` -- user is/isn't member of specified teams (calls `/api/user/teams`)

**Outcome registry** (`outcomes/outcomeRegistry.ts`):
```typescript
interface OutcomeRegistryItem<TSpec> extends RegistryItem {
  targetKinds: OutcomeTargetKind[];  // empty = dashboard-global
  specFromKind(kind: DashboardRuleOutcomeKindTypes): TSpec;
  specToKind(spec: TSpec): DashboardRuleOutcomeKindTypes;
  createDefaultSpec(): TSpec;
  Editor?: React.ComponentType<OutcomeEditorProps<TSpec>>;
}
```

Registered outcome types:
- **Visibility** -- show/hide panels, rows, tabs
- **Collapse** -- collapse/expand rows
- **Refresh interval** -- override dashboard refresh (dashboard-global, no targets needed)
- **Override query** (`outcomes/OverrideQueryOutcome.tsx`, 296 lines) -- swap panel queries at runtime; reverts to originals when rule deactivates. Uses `SceneQueryRunner` and `SceneDataTransformer` traversal.

#### Visibility/collapse hooks

- `useRuleBasedVisibility` / `useIsConditionallyHidden` -- consumed by panel/row/tab renderers to show/hide elements
- `useRuleBasedCollapse` -- consumed by `RowItemRenderer.tsx` for row collapse state

### Rules UI (settings views)

All in `public/app/features/dashboard-scene/settings/`:

#### DashboardRulesEditView.tsx (main container)

The "Rules" tab in dashboard settings. Manages:
- **View mode switcher**: RadioButtonGroup with modes: Flow (default), Builder, Simulator, Table
- **JSON toggle**: Toggleable right-side panel showing read-only rules JSON (via Monaco editor in `RulesJsonViewer.tsx`)
- **Dynamic height**: Measures available viewport space via `getBoundingClientRect()` + `window.innerHeight` to prevent page scrolling
- **View mode state**: `type ViewMode = 'table' | 'split' | 'builder' | 'simulator'`

The "Flow" tab label actually renders the `split` view mode internally (the original standalone flow-only view was removed).

#### RulesSplitView.tsx (Flow view, 403 lines)

Default view. Split layout:
- **Left panel** (340px): Scrollable rule list with natural language summaries, status dots, outcome badges. Clicking a rule highlights it in the flow editor.
- **Right panel**: Sentence builder strip at top (via exported `SentenceBuilder` component), XY flow editor below (`DashboardRulesFlowEditor`).
- When no rule is selected, all rules are shown normally. When one is selected, only that rule is highlighted and others are dimmed.
- Team names are resolved via `/api/teams/search` for readable summaries.

#### DashboardRulesFlowEditor.tsx (flow canvas)

Uses `@xyflow/react` (React Flow). Layout algorithm places nodes in columns:
- Column 1: Rule node (RULE_X = 0)
- Column 2: Target nodes
- Column 3: Condition nodes (with AND/OR connector nodes between them)
- Column 4: Outcome nodes

Node types: `RuleNode`, `TargetNode`, `ConditionNode`, `ConditionConnectorNode`, `OutcomeNode` (defined in `flow-nodes/FlowNodes.tsx`).

Features:
- `fitView` with padding 0.2 for auto-fit
- `minHeight: 0` (changed from 600 to prevent overflow with builder strip)
- Double-click rule node opens edit form
- Hover target node highlights corresponding element on dashboard canvas
- `simulatedActiveRules` prop for dimming non-selected rules (used by split view and simulator)
- `readOnly` prop disables dragging/connecting

#### RulesBuilderView.tsx (Builder view, 917 lines)

IFTTT-style rule builder. Split layout:
- **Left sidebar**: Existing rules as compact sentence cards with colored pills (IF blue / THEN orange / ON green)
- **Main area**: Centered interactive sentence builder

The `SentenceBuilder` component (exported, also used in Flow view):
- Single horizontal wrapping line: `IF [+ condition] AND/OR [+ condition] THEN [+ outcome] ON [target picker] [Create rule]`
- Condition picker: Select dropdown -> inline condition editor (renders the condition's `static Component`)
- Outcome picker: Select dropdown -> inline outcome editor (renders the outcome registry's `Editor` component)
- Target picker: Multi-select with removable pills
- AND/OR connector is clickable to toggle
- Handles `DashboardEditActionEvent` for condition editor state changes
- Conditions are parented to dashboard via `_parent` for scene graph traversal

#### RulesSimulator.tsx (Simulator view, 512 lines)

Generates all permutations of rule conditions and shows which rules would be active in each scenario:
- Extracts unique "dimensions" from conditions (time range thresholds, team memberships, variable values)
- Generates Cartesian product of all dimension values
- For each permutation, evaluates which rules would be active
- Deduplicates scenarios with identical active rule sets
- Displays as a selectable list with dimension values shown per scenario
- Team UIDs are resolved to names via `useTeamNames` hook
- Selecting a scenario highlights active rules in a read-only flow editor on the right

Layout: Two-column split with simulator list on left, read-only flow editor on right.

#### RulesTableView.tsx (Table view, 456 lines)

Compact table grouped by outcome type (e.g. "Visibility rules", "Query override rules"):
- Collapsible groups
- Columns: status dot, name, natural language summary, target chips, outcome badges
- Uses same `useTeamNames` hook for readable summaries

#### RulesJsonViewer.tsx (52 lines)

Monaco editor showing serialized rules JSON. Read-only. Toggleable in all view modes. Shown as a 400px right-side panel.

#### AddRuleForm.tsx (modified, +69 lines)

The rule creation/editing form rendered in the flow editor's top-right panel:
- Condition picker + inline editors
- Outcome picker + inline editors (with visibility show/hide radio)
- Multi-target selector
- Name field
- AND/OR match toggle
- Edit mode: pre-populates from existing rule
- Handles `DashboardEditActionEvent` for condition editor state changes

### Sidebar integration

#### DashboardRulesPane.tsx (edit-pane/)

Sidebar pane showing a preview of the rules flow canvas:
- Available in both edit and view mode
- "Rules" button in pane header navigates to the Rules settings view via `locationService.partial({ editview: 'rules' })`
- Registered as `openPane === 'rules'` in `DashboardEditPaneRenderer.tsx`
- Sidebar button uses `bolt` icon, gated behind `dashboardRules` feature toggle

### Other modifications

- **`datasource_srv.ts`** (+19 lines): Added `getInstanceSettingsByUid` method to `DatasourceSrv` for looking up datasource instances by UID (used by override query outcome).
- **`RowItemRenderer.tsx`** (+2 lines): Integrated `useRuleBasedCollapse` hook.
- **`FlowNodes.tsx`** (+8 lines): Added rule status badge rendering.

## Demo environment

### setup-demo.sh (499 lines)

Bash script that provisions a complete demo environment:
1. Creates folder "Black Friday operations"
2. Creates 3 users: `sre-user`, `product-user`, `business-user`
3. Creates 3 teams: `platform-sre`, `product-eng`, `business`
4. Adds users to appropriate teams (admin to all 3)
5. Imports the demo dashboard via v2beta1 API
6. With `--rules` flag: applies 11 rules via PATCH API

The 11 demo rules:
1. `sre-overview` -- hide SRE overview row if not platform-sre
2. `product-overview` -- hide Checkout health row if not product-eng
3. `business-overview` -- hide Business KPIs row if not business
4. `sre-infra-tab` -- hide Infrastructure tab if not platform-sre
5. `product-tab` -- hide Checkout & payments tab if not product-eng
6. `deep-dive-hidden` -- hide Deep dive tab (always, baseline)
7. `deep-dive-show` -- show Deep dive tab when time range <= 1h (overrides #6)
8. `fast-refresh` -- set refresh to 5s when time range <= 5m
9. `collapse-infra-compute` -- collapse Compute & network row when time range <= 30m
10. `override-request-rate` -- swap Request rate panel to live streaming when time range <= 5m
11. `override-latency` -- swap P99 latency to sine simulation when time range <= 5m

Note: Rules 6+7 work as a pair because a single rule can't express "hidden by default, shown conditionally" -- when a rule is inactive, the target reverts to its natural visible state. The always-true hide rule provides the baseline, and the conditional show rule overrides it.

### demo-dashboard.json (971 lines)

A "Black Friday war room" dashboard with:
- 4 tabs: War room, Infrastructure, Checkout & payments, Deep dive
- Multiple rows per tab with persona-specific content
- ~24 panels using testdata datasource
- Default time range: last 6 hours
- Uses tabs layout (`TabsLayoutKind`)

### demo-scenario.md (218 lines)

Recording script structured as 5 acts:
1. The problem (30s) -- show admin view, explain the pain
2. Persona-based visibility (1m 30s) -- switch between SRE/Product/Business users
3. Time-range driven behaviors (1m 30s) -- Deep dive tab, row collapse, fast refresh
4. Query override (45s) -- live streaming queries at short time ranges
5. How it works (45s) -- flow editor, hover highlighting, view modes

Includes an appendix comparing "with rules" vs "without rules" (1 dashboard vs 4, 24 panels vs 50+).

## Key design decisions

1. **Registry pattern**: Both conditions and outcomes are pluggable via registries. New types can be added without modifying core code.

2. **Last matching rule wins**: When multiple active rules target the same element, the last one in the array takes precedence. This enables the "hide baseline + show override" pattern.

3. **Non-destructive outcomes**: All outcomes revert when conditions stop being met. Original queries are cached and restored for query overrides.

4. **Dashboard-level vs element-level**: Rules live at the dashboard level (in `DashboardScene.state.dashboardRules`), not on individual elements. This decouples configuration from layout.

5. **Multi-target rules**: A single rule can target multiple panels, rows, or tabs via a `targets` array.

6. **View modes**: The Rules UI has 4 view modes (Flow, Builder, Simulator, Table) plus a toggleable JSON panel, designed for different workflows (visual editing, bulk management, testing, quick creation).

## Files inventory

### New files (uncommitted)
| File | Lines | Purpose |
|------|-------|---------|
| `settings/RulesBuilderView.tsx` | 917 | IFTTT-style sentence builder + existing rule cards |
| `settings/RulesSimulator.tsx` | 512 | Permutation-based rules simulator |
| `settings/RulesTableView.tsx` | 456 | Grouped table view of rules |
| `settings/RulesSplitView.tsx` | 403 | Default flow view (list + flow editor + builder) |
| `settings/RulesJsonViewer.tsx` | 52 | Monaco-based JSON viewer |
| `outcomes/OverrideQueryOutcome.tsx` | 296 | Query override outcome type |
| `demo-dashboard.json` | 971 | Demo dashboard JSON |
| `setup-demo.sh` | 499 | Demo provisioning script |
| `demo-scenario.md` | 218 | Demo recording script |

### Modified files (uncommitted)
| File | Delta | Purpose |
|------|-------|---------|
| `settings/DashboardRulesEditView.tsx` | +176 | View mode switcher, layout, JSON panel |
| `rules/DashboardRules.ts` | +121 | Collapse, refresh, query override outcomes |
| `settings/AddRuleForm.tsx` | +69 | Multi-target, outcome editors |
| `settings/DashboardRulesFlowEditor.tsx` | +65 | Layout fixes, builder integration |
| CUE schema files (x4) | +14 each | New outcome/condition types |
| Go codegen files (x4) | +73-157 each | Generated types |
| TS codegen files (x2) | +23 each | Generated types |
| Conversion files (x2) | +12 each | v2alpha1 <-> v2beta1 |
| Various others | small | Integration points |

## How to test

1. Enable feature toggle in `conf/custom.ini`:
   ```ini
   [feature_toggles]
   dashboardRules = true
   dashboardNewLayouts = true
   ```

2. Start Grafana (`make run` + `yarn start`)

3. Run demo setup:
   ```bash
   cd /Users/dominik/Projects/worktrees/dashboard-rules
   chmod +x setup-demo.sh
   ./setup-demo.sh --rules
   ```

4. Open `http://localhost:3000/d/war-room-black-friday`

5. Test by logging in as different users (`sre-user`, `product-user`, `business-user`) and changing time ranges.

6. In edit mode, open Dashboard settings > Rules to see the Rules UI.
