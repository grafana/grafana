# Critical User Journey (CUJ) Tracking

This documentation describes the Critical User Journey tracking framework in Grafana's frontend.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Architecture](#architecture)
  - [Components](#components)
  - [Data Flow](#data-flow)
- [Journeys](#journeys)
  - [search_to_resource](#search_to_resource)
  - [browse_to_resource](#browse_to_resource)
  - [dashboard_edit](#dashboard_edit)
  - [panel_edit](#panel_edit)
  - [datasource_configure](#datasource_configure)
  - [explore_to_dashboard](#explore_to_dashboard)
- [Adding a New Journey](#adding-a-new-journey)
  - [Step 0: Decide whether you need a journey](#step-0-decide-whether-you-need-a-journey)
  - [Step 1: Plan the journey shape](#step-1-plan-the-journey-shape)
  - [Step 2: Identify or add interactions](#step-2-identify-or-add-the-interactions-youll-listen-on)
  - [Step 3: Register metadata](#step-3-register-metadata)
  - [Step 4: Create the wiring file](#step-4-create-the-wiring-file)
  - [Step 5: Import at bootstrap](#step-5-import-at-bootstrap)
  - [Step 6: Write tests](#step-6-write-tests)
  - [Step 7: Verify locally](#step-7-verify-locally)
  - [Worked example: alert_rule_save](#worked-example-alert_rule_save)
  - [Lazy-Loaded Journeys](#lazy-loaded-journeys)
  - [Pre-merge checklist](#pre-merge-checklist)
- [API Reference](#api-reference)
  - [JourneyTracker](#journeytracker)
  - [JourneyHandle](#journeyhandle)
  - [StepHandle](#stephandle)
  - [JourneyRegistry](#journeyregistry)
- [Journey Patterns](#journey-patterns)
  - [Duration-Based Steps](#duration-based-steps)
  - [Late Attribute Enrichment](#late-attribute-enrichment)
  - [Concurrent Journeys](#concurrent-journeys)
  - [Parent Journeys](#parent-journeys)
  - [Discard vs Cancel vs Timeout](#discard-vs-cancel-vs-timeout)
- [Telemetry Output](#telemetry-output)
  - [OTel Traces (Tempo)](#otel-traces-tempo)
  - [Faro Measurements (Loki)](#faro-measurements-loki)
- [Debugging and Development](#debugging-and-development)
  - [Enable Debug Logging](#enable-debug-logging)
  - [Console Output Examples](#console-output-examples)
  - [Smoke runner: scripts/cuj-smoke.ts](#smoke-runner-scriptscuj-smokets)
- [Implementation Details](#implementation-details)
  - [Noop Tracker](#noop-tracker)
  - [Handle Lifecycle](#handle-lifecycle)
  - [Tab Visibility and Unload](#tab-visibility-and-unload)
  - [Registry Validation](#registry-validation)
  - [Handle Buffering](#handle-buffering)

## Overview

The CUJ tracking framework instruments multi-step user workflows with defined start and end conditions. Unlike per-interaction tracking (which measures individual actions like `dashboard_view` or `filter_added` in isolation), journey tracking composes multiple interactions into a single trace that represents a complete user workflow.

**What it measures:**

- Full workflow duration (e.g., "open command palette, search, navigate to dashboard, see it loaded" = 3.4s)
- Individual steps within a workflow as child spans with duration
- Journey outcome: `success`, `timeout`, `abandoned`, `error`, `discarded`, `canceled`
- Concurrent journey correlation (user browsing a dashboard list while also searching via command palette)

**What it does NOT replace:**

- Per-interaction profiling (`dashboard_render`, `panel_render`) - journeys compose on top of these
- The existing `SceneRenderProfiler` system - journeys use interaction events as triggers

## Configuration

Journey tracking is controlled by the `cujTracking` feature toggle:

```ini
[feature_toggles]
cujTracking = true
```

When disabled, all journey API calls resolve to a `NoopJourneyTracker` with zero overhead. No journey code executes, no spans are created, no measurements are emitted.

Journey data is reported through [Faro](https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/). Faro must be enabled and configured for traces and measurements to flow:

```ini
[log.frontend]
enabled = true
custom_endpoint = https://faro-collector-<region>.grafana.net/collect/<app-key>
instrumentations_tracing_enabled = true
```

## Architecture

### Components

The framework uses a hybrid architecture: a metadata-only registry for governance combined with imperative trigger registration for flexibility.

```
┌─────────────────────────────────────────────────────┐
│ JOURNEY_REGISTRY (journeyRegistry.ts)               │
│ Static metadata: type, description, owner, timeout, │
│ parents (optional)                                  │
│ No runtime logic - pure data                        │
└─────────────┬───────────────────────────────────────┘
              │ init()
              ▼
┌─────────────────────────────────────────────────────┐
│ JourneyRegistryImpl                                 │
│ - Validates registerTriggers/onInstance calls         │
│ - Merges registry metadata into startJourney opts   │
│ - Manages handle buffering for lazy registration    │
│ - Cleans up per-handle end-trigger subscriptions    │
└──────┬──────────────────────────────┬───────────────┘
       │ registerTriggers(type, startFn) │ onInstance(type, endFn)
       ▼                              ▼
┌──────────────────┐    ┌──────────────────────────────┐
│ Journey wiring   │    │ Journey wiring               │
│ (per journey)    │    │ (per journey instance)       │
│                  │    │                              │
│ Subscribes to    │    │ Subscribes to end-condition  │
│ start-condition  │    │ interaction events.          │
│ interaction      │    │ Calls handle.end(outcome).   │
│ events.          │    │ Returns cleanup function.    │
│ Calls            │    │                              │
│ tracker          │    │ Runs once per journey        │
│ .startJourney(). │    │ instance (not once globally) │
│ Returns cleanup. │    │                              │
└──────┬───────────┘    └──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│ JourneyTrackerImpl                                  │
│ - Creates JourneyHandleImpl with OTel root span     │
│ - Manages active journey map (keyed by journeyId)   │
│ - Tracks concurrent journeys via span links         │
│ - Handles timeout, visibility, beforeunload         │
│ - Emits logMeasurement('journey_complete') on end   │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
User action (e.g., cmd+k)
  │
  ▼
reportInteraction('command_palette_opened')
  │
  ▼
onInteraction callback in journey wiring
  │
  ▼
tracker.startJourney('search_to_resource', { attributes })
  │
  ├── OTel: root span created (journey:search_to_resource)
  ├── Timeout timer started
  └── Handle stored in activeJourneys map
  │
  ... user navigates ...
  │
  ▼
reportInteraction('dashboards_init_dashboard_completed')
  │
  ▼
onInteraction callback in endFn
  │
  ▼
handle.end('success', { dashboardUid })
  │
  ├── OTel: span ended with attributes + outcome
  ├── Faro: logMeasurement('journey_complete', { duration, stepCount, ... })
  ├── Timeout timer cleared
  ├── Per-handle end-trigger listeners cleaned up
  └── Handle removed from activeJourneys map
```

## Journeys

### search_to_resource

**File:** `public/app/core/journeys/searchToResource.ts`

User searches for a resource via command palette and navigates to it.

| Event           | Trigger                                                        | Action                                                                 |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Start           | `command_palette_opened`                                       | Journey starts                                                         |
| Mid-journey     | `command_palette_action_selected`                              | Sets `resourceType` (`dashboard`, `folder`, or `other`) and `actionId` |
| End (success)   | `dashboards_init_dashboard_completed`                          | Dashboard loaded                                                       |
| End (success)   | `grafana_browse_dashboards_page_view` (after folder selection) | Folder loaded                                                          |
| End (success)   | `command_palette_closed` (after nav action selection)          | Page navigation completed                                              |
| End (discarded) | `command_palette_closed` (without prior action selection)      | User dismissed palette                                                 |

**Key behaviors:**

- Starts on palette open, not action select - captures the full "intent to find something" flow.
- Resource type detection uses action ID prefixes: `go/dashboard` -> dashboard, `go/folder` -> folder, anything else -> other (nav action).
- Nav actions (Explore, Alerting, etc.) end as `success` when the palette closes after selection, since the close IS the navigation.
- `command_palette_closed` is a silent interaction - fires `onInteraction` subscribers but is not sent to analytics backends.

### browse_to_resource

**File:** `public/app/core/journeys/browseToResource.ts`

User navigates the browse dashboards page, drills into folders, and opens a resource.

| Event         | Trigger                                                       | Action                                      |
| ------------- | ------------------------------------------------------------- | ------------------------------------------- |
| Start         | `grafana_browse_dashboards_page_view` (first)                 | Journey starts                              |
| Step          | `grafana_browse_dashboards_page_click_list_item` (folder)     | `navigate_folder` step starts               |
| Step end      | `grafana_browse_dashboards_page_view` (subsequent)            | `navigate_folder` step ends (folder loaded) |
| Step          | `grafana_browse_dashboards_page_click_list_item` (non-folder) | `select_resource` step starts               |
| End (success) | `dashboards_init_dashboard_completed`                         | `select_resource` step ends, journey ends   |

**Key behavior:** Steps have real duration. `navigate_folder` measures click-to-folder-render. `select_resource` measures click-to-dashboard-load. Subsequent `page_view` events after the first are folder navigation steps, not new journey starts.

**Concurrent with search:** If the user opens the command palette mid-browse, both `browse_to_resource` and `search_to_resource` run concurrently. Both end on `dashboards_init_dashboard_completed`. The concurrent journey attributes and OTel span links capture the relationship.

### dashboard_edit

**File:** `public/app/core/journeys/dashboardEdit.ts`

User enters dashboard edit mode, makes changes, and saves or discards.

| Event           | Trigger                                                  | Action         |
| --------------- | -------------------------------------------------------- | -------------- |
| Start           | `dashboards_edit_button_clicked`                         | Journey starts |
| End (success)   | `grafana_dashboard_saved` or `grafana_dashboard_created` | Journey ends   |
| End (discarded) | `dashboards_edit_discarded`                              | Journey ends   |

**Key behavior:** Handles both `_saved` (existing dashboard) and `_created` (new dashboard) end triggers. Timeout is 30 minutes (long editing sessions are expected).

### panel_edit

**File:** `public/app/core/journeys/panelEdit.ts`

User opens a panel in edit mode and configures queries, transformations, or visualization.

| Event           | Trigger                                                                       | Action                              |
| --------------- | ----------------------------------------------------------------------------- | ----------------------------------- |
| Start           | `dashboards_panel_action_clicked` (with `item: 'edit'` or `'configure'`)      | Journey starts                      |
| Step            | `grafana_panel_edit_next_interaction` (action=`add_query`)                    | `add_query` step                    |
| Step            | `grafana_panel_edit_next_interaction` (action=`add_transformation_initiated`) | `add_transformation` step           |
| Step            | `grafana_panel_edit_next_interaction` (action=`change_sidebar_view`)          | `change_view` step                  |
| Step            | `grafana_panel_edit_next_interaction` (any other action)                      | step named after the action         |
| End (success)   | `panel_edit_closed` (no prior discard)                                        | Editor deactivated via save / close |
| End (discarded) | `panel_edit_closed` (after `panel_edit_discarded`)                            | User hit Discard                    |

**Silent interactions added by this journey:** `panel_edit_closed` (emitted when the PanelEditor scene deactivates), `panel_edit_discarded` (emitted when the user hits Discard).

**Attributes:**

- `panelId` — panel ID being edited.
- `source` — entry point (`panel`, `keyboard`, etc).
- `grafana.panel.type` — panel viz type at edit start (e.g. `timeseries`, `table`, `stat`). Lets you slice journey metrics by visualisation. Captured at start and not updated mid-edit; if the user changes panel type, that's surfaced as a step rather than a re-attribute. Sourced from `dashboards_panel_action_clicked`'s `panelType` property.

**Parent journey:** `panel_edit` declares `dashboard_edit` as its parent. When a `dashboard_edit` is active and a `panel_edit` starts, the `panel_edit` root span nests under the `dashboard_edit` root in the same trace — Tempo shows them as one waterfall. See [Parent Journeys](#parent-journeys).

**Key behavior:** Each panel-edit interaction is a pointwise `recordEvent` (no duration, no StepHandle to end). The journey distinguishes save vs discard via a latched flag set on `panel_edit_discarded`. 30-minute timeout matches long editing sessions.

### datasource_configure

**File:** `public/app/core/journeys/datasourceConfigure.ts`

User adds and configures a new datasource until a successful connection test.

| Event           | Trigger                                                      | Action                                          |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Start           | `connections_datasource_list_add_datasource_clicked`         | Journey starts (from list page)                 |
| Start           | `connections_new_datasource_page_view` (no active journey)   | Journey starts (direct nav)                     |
| Start           | `grafana_ds_add_datasource_clicked` (no active journey)      | Journey starts (catalog pick)                   |
| Step            | `grafana_ds_add_datasource_clicked` (journey already active) | `select_type` step                              |
| Step            | `connections_datasources_ds_configured`                      | `save_config` step                              |
| Step            | `grafana_ds_test_datasource_clicked` (success=false)         | `test_failed` step (repeatable)                 |
| End (success)   | `grafana_ds_test_datasource_clicked` (success=true)          | Test passed                                     |
| End (discarded) | `connections_new_datasource_cancelled`                       | User clicked Cancel                             |
| End (discarded) | `connections_datasource_deleted`                             | User deleted datasource before completing setup |
| End (abandoned) | `connections_datasource_config_page_left`                    | User navigated away without testing             |

**Silent interactions added by this journey:** `connections_new_datasource_cancelled`, `connections_datasource_deleted`, `connections_datasource_config_page_left`, `connections_new_datasource_page_view`.

**Key behavior:** The same event (`grafana_ds_test_datasource_clicked`) is either a `test_failed` step or a `success` end depending on the `success` property - this is the classic "dual-meaning event" case that drove the hybrid design choice. 1-hour timeout tolerates reading docs mid-setup.

### explore_to_dashboard

**File:** `public/app/core/journeys/exploreToDashboard.ts`

User adds a panel from Explore to a dashboard via the "Add to dashboard" form.

| Event           | Trigger                              | Action                                                  |
| --------------- | ------------------------------------ | ------------------------------------------------------- |
| Start           | `e_2_d_open`                         | User opens the "Add to dashboard" modal                 |
| Step            | `e_2_d_submit`                       | `submit` step with `saveTarget` and `newTab` attributes |
| End (success)   | `explore_to_dashboard_panel_applied` | Panel applied to the target dashboard                   |
| End (discarded) | `e_2_d_discarded`                    | Form closed without submitting                          |

**Silent interactions added by this journey:** `explore_to_dashboard_panel_applied` (emitted by `addPanelsOnLoadBehavior` when the panel is applied), `e_2_d_discarded` (emitted on form dismiss).

**Key behavior:** Single-tab case ends on success cleanly. New-tab case currently times out after 60 seconds because the `panel_applied` event fires in a different tab and cross-tab correlation is not implemented. Cross-tab correlation is a backlog item.

## Adding a New Journey

> **Fast path:** `yarn cuj:new <type> [--with-smoke]` scaffolds the wiring file, test file, optional smoke driver, registry entry, and bootstrap import in one go. The agent recipe in [`AGENTS.md`](./AGENTS.md) is the compact agent-facing variant of this section.

This section walks through instrumenting a new CUJ end-to-end. Worked example at the bottom.

### Step 0: Decide whether you need a journey

A journey is the right tool when **all** of these hold:

- The workflow has **clear start and end conditions** that you can detect from interactions, scene events, or DOM signals.
- The workflow spans **more than one interaction** or **more than one route**.
- You want **a single duration number** for the whole flow (an SLO target, an outcome breakdown, or a Tempo waterfall).

If you just want to time one operation, use the existing `reportInteraction` performance tracking. If the start/end conditions are fuzzy ("user is doing something useful"), tighten the definition before instrumenting — a journey with vague endpoints produces worthless metrics.

### Step 1: Plan the journey shape

Before writing code, write down (in the wiring file's docblock):

- **Type name** in `snake_case`. Becomes the OTel span name (`journey:<type>`) and the `journeyType` measurement field.
- **Owner squad**.
- **Start trigger(s)** — which interaction or scene event starts a new journey.
- **Steps** — pointwise events (`recordEvent`) or duration measurements (`startStep` / `step.end()`). What user actions matter inside this flow?
- **End conditions** — at minimum a success path. List discard, navigate-away, and error paths if relevant.
- **Timeout** — the longest plausible duration. If the user is reading docs (e.g. `datasource_configure`), be generous.
- **Cancel-on-restart** — default `true`. Set `false` only if multiple instances of the same journey can legitimately run side-by-side.
- **Parent journey** — if this workflow happens inside another (e.g. `panel_edit` happens inside `dashboard_edit`), declare it. See [Parent Journeys](#parent-journeys).

Keep this docblock at the top of the wiring file — it's the contract.

### Step 2: Identify or add the interactions you'll listen on

Journey wiring only listens to interactions; it never adds DOM event listeners or scene subscriptions directly. Two cases:

1. **Existing interaction is enough.** Pick the existing `reportInteraction(name, props)` call sites that mark your start, steps, and end. Use those names in `onInteraction()`.
2. **No suitable interaction exists.** Add a new `reportInteraction` call at the right point in the feature code. If the new interaction has _no analytics value beyond CUJ tracking_, mark it `silent: true` so it stays out of Rudderstack/Faro analytics:

   ```typescript
   reportInteraction('panel_edit_closed', { panelId }, { silent: true });
   ```

   Naming convention: `<feature>_<event>_<state>` (e.g. `panel_edit_closed`, `e_2_d_discarded`). Keep silent interactions documented in the [Silent Interactions](#silent-interactions) section.

### Step 3: Register metadata

Add an entry to `public/app/core/services/journeyRegistry.ts`:

```typescript
export const JOURNEY_REGISTRY: JourneyMeta[] = [
  // ... existing entries
  {
    type: 'your_journey_name',
    description: 'What the user is doing',
    owner: 'your-squad',
    timeoutMs: 60_000,
    // Optional. If any listed parent is active when this journey starts,
    // its root span nests under the parent's root span (same trace).
    parents: ['some_parent_journey'],
  },
];
```

This is data only. The registry enforces that `registerTriggers` and `onInstance` calls reference a known type (throws otherwise).

| Field             | Required                  | Description                                                                                                                      |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `type`            | yes                       | Unique identifier. Used as the OTel span name (`journey:<type>`) and the `journeyType` measurement field.                        |
| `description`     | yes                       | Human-readable summary of the workflow.                                                                                          |
| `owner`           | yes                       | Squad name (e.g. `grafana-dashboards`). Used for routing alerts and ownership reviews.                                           |
| `timeoutMs`       | yes                       | Auto-end as `timeout` after this many ms. Pick generously — overshooting wastes a row, undershooting drops real journeys.        |
| `cancelOnRestart` | optional (default `true`) | When `true`, starting a same-type journey cancels the previous one. Set `false` for journeys that legitimately run concurrently. |
| `parents`         | optional                  | Other journey types that should be treated as parents. See [Parent Journeys](#parent-journeys).                                  |

### Step 4: Create the wiring file

Create `public/app/core/journeys/yourJourney.ts`:

```typescript
import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

// registerJourneyTriggers runs once at bootstrap (global scope)
registerJourneyTriggers('your_journey_name', (tracker) => {
  return onInteraction('your_start_event', (props) => {
    tracker.startJourney('your_journey_name', {
      attributes: {
        // str() coerces null/undefined to '' so attributes never ship 'undefined'
        someId: str(props.someId),
      },
    });
  });
});

// onJourneyInstance runs per journey instance
onJourneyInstance('your_journey_name', (handle) => {
  const { add, cleanup } = collectUnsubs();

  // recordEvent: pointwise event (no duration, nothing to end)
  add(
    onInteraction('your_milestone_event', (props) => {
      handle.recordEvent('milestone', { detail: str(props.detail) });
    })
  );

  // startStep: measures elapsed time between two events - caller must end the handle
  add(
    onInteraction('your_step_start', () => {
      const step = handle.startStep('my_step');
      // Stash `step` somewhere (instance-scoped variable) and call step.end() on the matching event.
    })
  );

  // end() and recordEvent() are idempotent - safe to call after the journey ends.
  // No isActive guards needed unless you want to skip extra work before the call.
  add(
    onInteraction('your_success_event', () => {
      handle.end('success');
    })
  );

  add(
    onInteraction('your_cancel_event', () => {
      handle.end('discarded');
    })
  );

  return cleanup;
});
```

**Key difference:** `registerJourneyTriggers` fires once globally at bootstrap. `onJourneyInstance` fires once per journey instance - each time a journey starts, your function is called with that instance's handle. Per-handle end-trigger listeners are cleaned up automatically when the handle ends.

### Step 5: Import at bootstrap

Add the import to `public/app/app.ts`:

```typescript
await Promise.all([
  import('./core/journeys/searchToResource'),
  import('./core/journeys/browseToResource'),
  import('./core/journeys/dashboardEdit'),
  import('./core/journeys/panelEdit'),
  import('./core/journeys/datasourceConfigure'),
  import('./core/journeys/exploreToDashboard'),
  import('./core/journeys/yourJourney'), // <-- add here
]);
```

This must come after the tracker and registry are initialized. The import triggers `registerJourneyTriggers` / `onJourneyInstance` calls as side effects. If you skip this step, `warnUnregistered()` logs a `console.warn` at the end of bootstrap (dev only), which is the canary that catches forgotten imports.

For lazily-imported journeys (wiring lives inside a feature module that's `import()`-ed on demand), still register the metadata in `journeyRegistry.ts` — only the wiring import goes elsewhere. See [Lazy-Loaded Journeys](#lazy-loaded-journeys).

### Step 6: Write tests

Add `yourJourney.test.ts` next to the wiring file. Use the test harness in `public/app/core/journeys/__test-utils__/journeyTestHarness.ts`. The harness gives you a fake interaction bus and a mock `JourneyHandle` so you can drive the wiring without booting Grafana.

A typical test asserts:

- **Start:** firing the start interaction creates a journey with the right type and starting attributes.
- **Steps:** each step interaction calls `recordEvent` or `startStep` with the expected name and attributes.
- **End paths:** success, discard, and (where applicable) timeout. For each, assert `handle.end` is called with the right outcome.
- **Cleanup:** when the journey ends, the end-trigger listeners are removed (`add(...)` returns are cleaned up by `collectUnsubs`). The harness exposes interaction-listener counts so you can check this directly.

See `panelEdit.test.ts` (recordEvent-heavy) and `browseToResource.test.ts` (startStep / step.end heavy) for the two main shapes.

### Step 7: Verify locally

1. Enable the feature toggle: in `conf/custom.ini`,

   ```ini
   [feature_toggles]
   cujTracking = true
   ```

2. Wire Faro to a Tempo + Loki backend in `conf/custom.ini` (see [Configuration](#configuration) for the `[log.frontend]` block).

3. Open Chrome devtools console. The framework logs every journey lifecycle event when `localStorage.setItem('grafana.debug.journeyTracker', 'true')` is set. You'll see `journeyTracker.JourneyTracker startJourney …`, step events, and the end outcome.

4. Walk the workflow you instrumented. Confirm in the console:
   - `startJourney` fires with your type and attributes.
   - Each step fires with the right name.
   - `end` fires with `outcome=success` (or whichever you triggered).

5. Confirm in Tempo: TraceQL `{ .journey.type = "your_journey_name" }` returns at least one trace. Open it — root span name `journey:your_journey_name`, child spans named `step:<name>`.

6. Confirm in Loki: `{kind="measurement"} | logfmt | type="journey_complete" | context_journeyType="your_journey_name"` returns measurements. The `value_totalDuration` and `value_stepCount` numerics, plus your custom attributes as `context_*` labels, should be there.

7. Trigger negative paths too: navigate away, hit Discard, leave the tab open past the timeout. Confirm the right `outcome` shows up in measurements.

### Worked example: alert_rule_save

Putting it all together for a hypothetical journey: "user opens the alert rule editor, fills in fields, saves successfully or discards."

**Step 0:** Multi-step (open → fill → save), clear start (form mounts) and end (save succeeds), worth a journey for SLO and adoption metrics. Yes.

**Step 1 (plan):**

- Type: `alert_rule_save`. Owner: `grafana-alerting`.
- Start: `alerting_rule_form_mounted` (new silent interaction we'll add in step 2).
- Steps: `add_query`, `change_evaluation`, `add_label`, `change_notifications` (each pointwise — single click; `recordEvent`).
- End — success: `alerting_rule_save_succeeded`.
- End — discarded: `alerting_rule_form_dismissed` without a prior save.
- Timeout: 30 minutes (forms can be left open).
- Parents: none. (Editing an alert rule isn't structurally inside another journey.)

**Step 2 (interactions):**

- `alerting_rule_form_mounted` — new, silent. Fired in `useEffect(() => …)` when the form component mounts.
- `alerting_rule_save_succeeded` — already exists in the alerting feature for analytics; reuse.
- `alerting_rule_form_dismissed` — new, silent. Fired in the discard handler.

**Step 3 (registry):**

```ts
{
  type: 'alert_rule_save',
  description: 'User creates or edits an alert rule and saves it',
  owner: 'grafana-alerting',
  timeoutMs: 30 * 60_000,
}
```

**Step 4 (wiring):**

```ts
// public/app/features/alerting/journeys/alertRuleSave.ts
import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';
import { collectUnsubs, str } from 'app/core/journeys/utils';

registerJourneyTriggers('alert_rule_save', (tracker) => {
  return onInteraction('alerting_rule_form_mounted', (props) => {
    tracker.startJourney('alert_rule_save', {
      attributes: {
        ruleType: str(props.ruleType),
        editing: str(props.isEdit),
      },
    });
  });
});

onJourneyInstance('alert_rule_save', (handle) => {
  const { add, cleanup } = collectUnsubs();
  let dismissed = false;

  add(
    onInteraction('alerting_rule_form_field_changed', (props) => {
      handle.recordEvent(str(props.field) || 'field_change', {
        field: str(props.field),
      });
    })
  );

  add(
    onInteraction('alerting_rule_save_succeeded', () => {
      handle.end('success');
    })
  );

  add(
    onInteraction('alerting_rule_form_dismissed', () => {
      dismissed = true;
      handle.end('discarded');
    })
  );

  return cleanup;
});
```

**Step 5 (bootstrap):** since this is alerting-specific, lazy-load it from inside the alerting module rather than from `app.ts`. Add `import('./journeys/alertRuleSave')` in the alerting feature's bootstrap path.

**Step 6 (tests):** see `panelEdit.test.ts` for the recordEvent shape; copy the harness setup, replace journey type and interactions.

**Step 7 (verify):** open the alert rule editor, change a few fields, hit Save. In Tempo: `{ .journey.type = "alert_rule_save" }` shows a trace with step children for each field change. In Loki: a `journey_complete` measurement with `outcome=success`.

### Lazy-Loaded Journeys

Not all journeys need to be eagerly loaded. If a journey starts inside feature code (e.g., alert rule creation starts when the form mounts), the wiring can live in the feature module:

```typescript
// In public/app/features/alerting/journeys/createAlertRule.ts
import { registerJourneyTriggers, onJourneyInstance, onInteraction } from '@grafana/runtime';

registerJourneyTriggers('create_alert_rule', (tracker) => {
  // ...
  return () => {
    /* cleanup */
  };
});

onJourneyInstance('create_alert_rule', (handle) => {
  // ...
  return () => {
    /* cleanup */
  };
});
```

Only the registry metadata entry stays in `app.ts` (it's just data). The wiring code lives wherever makes sense for the feature.

**Handle buffering:** If a journey starts before `onJourneyInstance` has been called (because the end-trigger code is in a lazy-loaded module), the registry buffers the handle. When `onJourneyInstance` runs, it replays buffered handles.

**Tradeoff:** If the user triggers a start interaction before the lazy module loads, the `onInteraction` listener isn't registered yet and nothing happens. This is fine for journeys that start inside the feature (like form mount), but it's why `search_to_resource` is eager - the command palette opens from anywhere before feature code loads.

### Pre-merge checklist

- [ ] Registry entry added with owner, timeout, and (if applicable) `parents`.
- [ ] Wiring file has a docblock that names start/steps/end conditions.
- [ ] Silent interactions (if any) listed in the [Silent Interactions](#silent-interactions) table.
- [ ] Tests cover start, each step, success path, discard path. Cleanup verified.
- [ ] Local verification done: trace appears in Tempo, measurement appears in Loki, debug log shows expected lifecycle.
- [ ] If lazy-loaded: import is placed in the feature's bootstrap path, not `app.ts`.
- [ ] If new interactions were added: `silent: true` set when they have no analytics value beyond CUJ tracking.

## API Reference

### JourneyTracker

The top-level factory. Accessed via `getJourneyTracker()` from `@grafana/runtime`.

| Method                         | Description                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `startJourney(type, options?)` | Start a new journey instance. Returns a `JourneyHandle`.    |
| `getActiveJourney(type)`       | Get the most recent active journey of this type, or `null`. |
| `cancelAll()`                  | End all active journeys as `canceled`.                      |

**`JourneyOptions`:**

| Field             | Type                     | Default          | Description                                                                 |
| ----------------- | ------------------------ | ---------------- | --------------------------------------------------------------------------- |
| `timeoutMs`       | `number`                 | `300000` (5 min) | Auto-end as `timeout` after this duration. Overridden by registry metadata. |
| `cancelOnRestart` | `boolean`                | `true`           | If true, starting a new journey of the same type cancels the previous one.  |
| `attributes`      | `Record<string, string>` | `{}`             | Initial attributes attached to the OTel span and measurement.               |

### JourneyHandle

A bound reference to one specific journey instance. All step/end operations go through the handle.

| Method/Property                  | Description                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `journeyId`                      | Unique ID for this instance. Equals the OTel trace ID when tracing is enabled.                                                                         |
| `journeyType`                    | The journey type string (e.g., `'search_to_resource'`).                                                                                                |
| `isActive`                       | `true` until `end()` is called.                                                                                                                        |
| `recordEvent(name, attributes?)` | Record a pointwise event. Zero-duration child span - no handle returned, nothing to end. Idempotent no-op after `end()`.                               |
| `startStep(name, attributes?)`   | Start a duration step. Returns a `StepHandle` - you MUST call `step.end()` when the measured operation completes. Returns a noop handle after `end()`. |
| `end(outcome, attributes?)`      | End the journey. Idempotent - second call is a no-op.                                                                                                  |
| `setAttributes(attrs)`           | Enrich the journey with additional attributes. Can be called multiple times. No-op after `end()`.                                                      |

### StepHandle

Returned by `handle.startStep()`. Represents a child span in the OTel trace.

| Method             | Description                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `end(attributes?)` | End the step. The time between `startStep` and `end` is the step's duration in the trace. |

**Pointwise events vs duration steps:**

The split API makes the contract explicit at the call site - you never have to remember "did I need to end this?"

```typescript
// Pointwise event: no handle returned, nothing to end.
handle.recordEvent('user_clicked_something', { target: 'button' });

// Duration step: StepHandle returned, caller MUST end it.
const step = handle.startStep('navigate_folder', { folderUID: 'abc' });
// ... later, when the folder loads ...
step.end({ folderUID: 'abc' });
```

### JourneyRegistry

Manages journey metadata and trigger registration. Not typically accessed directly - use `registerJourneyTriggers` and `onJourneyInstance` from `@grafana/runtime`.

| Method                            | Description                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `init(metadataList)`              | Load journey metadata. Called once at bootstrap.                                  |
| `registerTriggers(type, startFn)` | Register a start trigger. Throws if type is not in registry.                      |
| `onInstance(type, endFn)`         | Register an end trigger. Throws if type is not in registry or already registered. |
| `warnUnregistered()`              | Log warnings for registry entries with no start trigger. Called after bootstrap.  |
| `getMeta(type)`                   | Get metadata for a journey type.                                                  |
| `destroy()`                       | Clean up all registrations.                                                       |

## Journey Patterns

### Duration-Based Steps

Steps can measure elapsed time between two events. Hold the `StepHandle` and call `end()` when the operation completes:

```typescript
onJourneyInstance('browse_to_resource', (handle) => {
  let pendingStep: StepHandle | null = null;
  const { add, cleanup } = collectUnsubs();

  // Start step on folder click
  add(
    onInteraction('folder_clicked', (props) => {
      pendingStep = handle.startStep('navigate_folder', {
        folderUID: str(props.uid),
      });
    })
  );

  // End step when folder loads
  add(
    onInteraction('folder_loaded', (props) => {
      if (pendingStep) {
        pendingStep.end({ folderUID: str(props.folderUID) });
        pendingStep = null;
      }
    })
  );

  return cleanup;
});
```

In Tempo, this produces a child span with real duration:

```
journey:browse_to_resource  ████████████████████████████  12.0s
  step:navigate_folder        ████  1.8s
  step:navigate_folder             ███  1.2s
  step:select_resource                    ██████████  4.1s
```

**Per-instance state.** Put step-tracking variables inside `onJourneyInstance` so each journey instance gets its own closure. A module-scope `StepHandle` lives across journey instances - if the previous journey cancels while its step is pending, a later journey's end event would call `.end()` on a dead span. Keeping state inside `onJourneyInstance` avoids this entirely.

Interaction callbacks within the same journey cannot interleave: JavaScript is single-threaded and `onInteraction` fires synchronously inside `reportInteraction`, so there is no race between the click handler that sets `pendingStep` and the page-view handler that reads it.

```typescript
onJourneyInstance('your_journey', (handle) => {
  let pendingStep: StepHandle | null = null;
  const { add, cleanup } = collectUnsubs();

  add(
    onInteraction('step_start_event', () => {
      pendingStep = handle.startStep('my_step');
    })
  );

  add(
    onInteraction('step_end_event', () => {
      if (pendingStep) {
        pendingStep.end();
        pendingStep = null;
      }
    })
  );

  return cleanup;
});
```

### Late Attribute Enrichment

Start the journey early (on user intent), enrich with details as they become available:

```typescript
// Journey starts when palette opens - we don't know what the user wants yet
tracker.startJourney('search_to_resource', {
  attributes: { source: 'command_palette' },
});

// Later, when user selects an action, enrich with resource type
handle.setAttributes({
  resourceType: 'dashboard',
  actionId: 'go/dashboard/d/abc123/my-dashboard',
});
```

All attributes accumulate on the OTel span and are included in the `journey_complete` measurement.

### Concurrent Journeys

When multiple journeys are active simultaneously, the framework automatically:

1. Records `concurrent_journey_N_type` and `concurrent_journey_N_id` attributes on the new journey
2. Creates OTel span links between the concurrent trace root spans

This happens transparently in `JourneyTrackerImpl.startJourney`. No special wiring needed.

**Example:** User is on the browse page (`browse_to_resource` active), opens command palette (`search_to_resource` starts). The search journey's span attributes include `concurrent_journey_0_type: browse_to_resource` and a span link to the browse journey's trace.

### Parent Journeys

A journey type can declare structural parents in the registry. When any declared parent is active at start time, the new journey nests under that parent's root span — same trace, native Tempo waterfall — instead of creating a separate trace.

This is the right model for nested workflows where the inner journey is logically _inside_ the outer one. The canonical example is `panel_edit` happening during a `dashboard_edit`: the user is editing a dashboard, opens a panel for editing, finishes, and goes back to the dashboard. Concurrent links (one-way, separate traces) would let you discover that relationship after the fact, but Tempo wouldn't render both in one waterfall. Nesting does.

**Declaring a parent**

```ts
{
  type: 'panel_edit',
  description: 'User edits a panel',
  owner: 'grafana-dashboards',
  timeoutMs: 30 * 60_000,
  parents: ['dashboard_edit'],   // first listed and active wins
}
```

The `parents` field accepts multiple types. The tracker walks the list in order and uses the first one currently active. If none are active, the journey starts a new root trace as usual.

**What changes when a parent is active**

- The child's root span is created in the parent span's context (no `root: true`). Same `traceId` for both.
- The child's root span gets two extra attributes for queryability: `parent_journey.type` and `parent_journey.id`. You can still find all children of a given parent via TraceQL `{ .parent_journey.id = "<traceId>" }`.
- The parent is **excluded** from the child's `concurrent_journey_*` attributes and span links. Concurrency bookkeeping is reserved for _coincidental_ overlaps — a parent is not a coincidence, it's a structure. Other concurrent journeys that aren't the parent still show up in `concurrent_journey_*`.
- If the declared parent has already ended by the time the child starts, the child silently falls back to a new root span. No error, no warning.

**Telemetry**

The Faro `journey_complete` measurement for a nested journey carries `parent_journey.type` and `parent_journey.id` alongside the usual fields. SLO queries that filter `context_journeyType="panel_edit"` are unaffected — span attributes match TraceQL filters whether the span is root or nested.

**Why not bidirectional span links instead of nesting**

Span links go one way — new journey → existing journey — and OTel spans are immutable once started, so you can't update the parent's span when the child starts. Tempo's UI doesn't auto-traverse links inline. Nesting is the only model that gives you "view the parent trace, see the child as part of the waterfall" without UI work in Tempo.

### Discard vs Cancel vs Timeout

| Outcome     | Meaning                                 | When to use                                                  |
| ----------- | --------------------------------------- | ------------------------------------------------------------ |
| `success`   | User completed the intended workflow    | Resource loaded, save succeeded                              |
| `discarded` | User voluntarily abandoned the workflow | Closed palette without selecting, exited edit without saving |
| `canceled`  | System or another journey interrupted   | `cancelOnRestart: true` and same-type journey started        |
| `timeout`   | Journey exceeded `timeoutMs`            | Automatic - no wiring needed                                 |
| `abandoned` | User left the page entirely             | Tab hidden > 60s or `beforeunload` - automatic               |
| `error`     | Something went wrong                    | Explicit `handle.end('error')` call                          |

## Silent Interactions

Some interactions exist purely as CUJ signals and should not be sent to analytics backends. Use the `silent` option:

```typescript
reportInteraction('my_cuj_signal', { key: 'value' }, { silent: true });
```

Silent interactions:

- Fire `onInteraction` subscribers normally (journey tracking works)
- Skip all EchoSrv backends (not sent to Rudderstack, Faro analytics, etc.)
- Skip Echo debug logging

Use silent mode for interactions added specifically for journey tracking that have no standalone analytics value:

| Interaction                           | Why silent                                              |
| ------------------------------------- | ------------------------------------------------------- |
| `command_palette_closed`              | Only needed to detect palette dismiss vs navigation     |
| `grafana_browse_dashboards_page_view` | Only needed to detect folder load and journey start     |
| `panel_edit_closed`                   | Only needed to detect panel editor deactivation         |
| `panel_edit_discarded`                | Only needed to distinguish discard vs save before close |
| `explore_to_dashboard_panel_applied`  | Only needed to detect panel applied on dashboard side   |
| `e_2_d_discarded`                     | Only needed to detect form dismiss without submit       |

Existing interactions like `command_palette_opened`, `command_palette_action_selected`, and `dashboards_init_dashboard_completed` are NOT silent - they have independent analytics value.

## Telemetry Output

### OTel Traces (Tempo)

Each journey creates an OTel trace with the following structure:

**Root span:** `journey:<type>` (e.g., `journey:browse_to_resource`)

| Attribute                   | Description                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `journey.type`              | Journey type string                                                                                                                                               |
| `journey.outcome`           | `success`, `timeout`, `abandoned`, `error`, `discarded`, `canceled`                                                                                               |
| `journey.step_count`        | Number of steps in the journey                                                                                                                                    |
| `journey.duration_ms`       | Total duration in milliseconds                                                                                                                                    |
| `concurrent_journey_N_type` | Type of Nth concurrent journey (if any). Excludes the structural parent — see [Parent Journeys](#parent-journeys).                                                |
| `concurrent_journey_N_id`   | ID of Nth concurrent journey (if any)                                                                                                                             |
| `parent_journey.type`       | If this journey nested under a registered parent, the parent's type. Set even though the trace ID already correlates them, so consumers don't need to walk spans. |
| `parent_journey.id`         | Parent journey's `journeyId` (its trace ID). Useful for `{ .parent_journey.id = "<trace>" }` queries to find all child journeys of a given parent.                |
| Custom attributes           | All attributes set via `startJourney` options and `setAttributes` calls                                                                                           |

**Child spans:** `step:<name>` (e.g., `step:navigate_folder`)

| Attribute         | Description                                                           |
| ----------------- | --------------------------------------------------------------------- |
| `step.name`       | Step name                                                             |
| Custom attributes | Attributes passed to `recordEvent` / `startStep` and `stepHandle.end` |

**Span links:** Links to concurrent journey root spans (non-parent journeys only — a structural parent is captured by nesting, not links).

### Faro Measurements (Loki)

On every journey end, a `journey_complete` measurement is emitted via `logMeasurement`:

**Measurement values:**

| Field           | Type     | Description            |
| --------------- | -------- | ---------------------- |
| `totalDuration` | `number` | Journey duration in ms |
| `stepCount`     | `number` | Number of steps        |

**Measurement labels:**

| Field                 | Type     | Description                                                                                                          |
| --------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `journeyType`         | `string` | Journey type                                                                                                         |
| `journeyId`           | `string` | Unique journey instance ID                                                                                           |
| `outcome`             | `string` | Journey outcome                                                                                                      |
| `parent_journey.type` | `string` | (When nested) parent journey type. Same value as the span attribute.                                                 |
| `parent_journey.id`   | `string` | (When nested) parent journey's `journeyId`. Lets you join child measurements to a parent without a Tempo round-trip. |
| All custom attributes | `string` | Everything set via `setAttributes` and `end` attributes                                                              |

## Debugging and Development

### Enable Debug Logging

```javascript
localStorage.setItem('grafana.debug.journeyTracker', 'true');
```

Reload the page after setting. Uses `createDebugLog` from `app/core/utils/debugLog` - the same pattern as `grafana.debug.sceneProfiling` and `grafana.debug.dashboardAPI`.

### Console Output Examples

#### Journey Lifecycle

```
[JourneyTracker] startJourney search_to_resource {
  journeyId: "ddf9cf2dda370054306dae9cac7c48c3",
  timeoutMs: 60000,
  cancelOnRestart: true,
  attributes: { source: "command_palette" },
  concurrentJourneys: 0
}
[JourneyTracker] setAttributes search_to_resource {
  resourceType: "dashboard",
  actionId: "go/dashboard/d/abc123/my-dashboard"
}
[JourneyTracker] end search_to_resource -> success {
  journeyId: "ddf9cf2dda370054306dae9cac7c48c3",
  durationMs: 2341,
  stepCount: 0,
  attributes: {
    source: "command_palette",
    resourceType: "dashboard",
    actionId: "go/dashboard/d/abc123/my-dashboard",
    dashboardUid: "abc123"
  }
}
```

#### Steps with Duration

```
[JourneyTracker] startJourney browse_to_resource {
  journeyId: "a1b2c3d4e5f6...",
  attributes: { source: "browse_dashboards", folderUID: "" }
}
[JourneyTracker] startStep browse_to_resource/navigate_folder {
  journeyId: "a1b2c3d4e5f6...",
  stepNumber: 1,
  attributes: { folderUID: "team-dashboards" }
}
[JourneyTracker] setAttributes browse_to_resource {
  folderUID: "team-dashboards"
}
[JourneyTracker] startStep browse_to_resource/select_resource {
  journeyId: "a1b2c3d4e5f6...",
  stepNumber: 2,
  attributes: { resourceType: "dashboard", resourceUID: "wfTJJL5Wz" }
}
[JourneyTracker] end browse_to_resource -> success {
  journeyId: "a1b2c3d4e5f6...",
  durationMs: 8234,
  stepCount: 2,
  attributes: {
    source: "browse_dashboards",
    folderUID: "team-dashboards",
    resourceType: "dashboard",
    resourceUID: "wfTJJL5Wz",
    dashboardUid: "wfTJJL5Wz"
  }
}
```

#### Registry Logs

```
[JourneyRegistry] registerTriggers search_to_resource
[JourneyRegistry] registerTriggers browse_to_resource
[JourneyRegistry] registerTriggers dashboard_edit
[JourneyRegistry] onInstance search_to_resource
[JourneyRegistry] onInstance browse_to_resource
[JourneyRegistry] onInstance dashboard_edit
```

#### Discarded Journey

```
[JourneyTracker] startJourney search_to_resource {
  journeyId: "f1e2d3c4b5a6...",
  attributes: { source: "command_palette" }
}
[JourneyTracker] end search_to_resource -> discarded {
  journeyId: "f1e2d3c4b5a6...",
  durationMs: 1423,
  stepCount: 0,
  attributes: { source: "command_palette" }
}
```

### Smoke runner: `scripts/cuj-smoke.ts`

A Playwright-driven runner that exercises journeys repeatedly against a local Grafana, useful for populating CUJ dashboards with realistic telemetry while iterating on instrumentation or visualisations.

**Quick start:**

```bash
# Start Grafana (with cujTracking enabled and Faro wired) in another terminal first.
node --experimental-strip-types scripts/cuj-smoke.ts --runs 200
node --experimental-strip-types scripts/cuj-smoke.ts --runs 5 --headed
node --experimental-strip-types scripts/cuj-smoke.ts --runs 50 --scenario discarded
node --experimental-strip-types scripts/cuj-smoke.ts --runs 100 --journeys search_to_resource
```

**Architecture.** Each journey owns its smoke driver, co-located with the wiring file:

```
public/app/core/journeys/
├── searchToResource.ts            # browser-side wiring
├── searchToResource.smoke.ts      # Node-side Playwright driver
├── __smoke__/
│   ├── types.ts                   # JourneyDriver interface
│   └── playwright-utils.ts        # shared helpers (humanType, activate, ...)
└── ...
```

`scripts/cuj-smoke.ts` is the orchestrator: parses CLI flags, handles login + fixture creation, imports each journey driver, runs the loop, prints the summary. Adding a new journey to the runner means adding a `<name>.smoke.ts` file next to the wiring; the orchestrator imports and registers it.

**What a typical driver iteration does** (search_to_resource example):

- Picks a uniform-random scenario: `new-dashboard`, `home-dashboard`, `import-dashboard`, `existing-dashboard`, or `discarded`.
- Picks a uniform-random query variant for that scenario (`new dashboard`, `new dash`, `create dashboard`, …).
- Types it with one of four cadences: `burst` (40-60ms/char), `normal` (80-120ms/char), `thinking` (mid-word pause), or `hunting` (typo and correction).
- Activates with one of three styles: `mouse` (click first result), `keyboard-immediate` (ArrowDown + Enter), or `keyboard-browse` (1-4 ArrowDowns with occasional ArrowUp).
- The orchestrator listens for the journey end log via `page.on('console')` and captures the outcome + duration.
- Waits 2s after the journey ends so Faro's batched transport flushes the trace.

**One-time setup:** the script reuses `@grafana/plugin-e2e`'s `authenticate` Playwright project for login, caching storage state in `playwright/.auth/admin.json`. It also creates a fixture dashboard (`CUJ Smoke Fixture`) via the HTTP API for the `existing-dashboard` scenario.

**Output:** outcome histogram, journey × scenario × outcome breakdown, average duration, list of failures.

**Typecheck:** smoke files use explicit `.ts` import extensions (Node ESM with `--experimental-strip-types` requires them). They live under their own `tsconfig.smoke.json` so the main `yarn typecheck` and dev-server fork-ts-checker stay untouched. Run `yarn typecheck:smoke` to validate them locally. CI runs it as part of the frontend-lint workflow; lefthook runs it pre-commit when any smoke file is staged.

## Implementation Details

### Noop Tracker

When the `cujTracking` feature toggle is off, `getJourneyTracker()` returns a `NoopJourneyTracker`. All methods are no-ops. `startJourney` returns a shared `NOOP_HANDLE` with no-op `recordEvent`, `startStep`, `end`, and `setAttributes`. Zero allocation, zero overhead.

### Handle Lifecycle

```
startJourney()
  │
  ├── handle.isActive = true
  ├── OTel root span started
  ├── Timeout timer set
  ├── Stored in activeJourneys map (keyed by journeyId)
  │
  │   handle.recordEvent() / handle.startStep() / handle.setAttributes() / ...
  │
  ▼
handle.end(outcome)
  │
  ├── handle.isActive = false
  ├── Timeout timer cleared
  ├── OTel span ended with attributes + outcome
  ├── logMeasurement('journey_complete') emitted
  ├── Handle removed from activeJourneys map
  └── Per-handle onEnd callbacks invoked (end-trigger cleanup)
```

`end()` is idempotent - the second call is a no-op. `recordEvent()` after `end()` is a no-op. `startStep()` after `end()` returns a noop step handle. This is the contract wiring code relies on: no `isActive` guards needed around these calls.

### Tab Visibility and Unload

The tracker monitors tab visibility and page unload to handle abandoned journeys:

- **Tab hidden > 60 seconds:** All active journeys end as `abandoned` when the tab becomes visible again.
- **`beforeunload`:** All active journeys end as `abandoned`.

### Registry Validation

- `registerTriggers` throws if the journey type is not in the registry metadata.
- `onInstance` throws if the journey type is not in the registry metadata.
- `onInstance` throws if an end handler is already registered for that type.
- `warnUnregistered()` logs a warning for each registry entry with no start trigger (catches forgotten imports).

### Handle Buffering

When `onJourneyInstance` hasn't been called yet (lazy-loaded module), journey handles are buffered:

1. `startJourney` fires, no `endFn` registered for this type.
2. Handle is added to the buffer with a timeout matching the journey's `timeoutMs`.
3. When `onJourneyInstance` is called, buffered handles are replayed: `endFn(handle)` is called for each still-active handle.
4. Stale buffered handles (past timeout) are cleaned up automatically.
