---
title: Critical User Journeys
description: How to add and modify CUJ instrumentation in Grafana
globs:
  - 'public/app/core/journeys/**'
---

# CUJ instrumentation - Agent Configuration

This directory holds the runtime wirings for Critical User Journeys (CUJs) — multi-step user workflows tracked end-to-end as OTel traces + Faro measurements behind the `cujTracking` feature toggle.

## Required Reading

Always read these before adding or modifying a journey:

1. **`./journey-tracking.md`** - the canonical reference. It covers architecture, telemetry shape, the registry, parent journeys, debug logging, and a full worked example.
2. **`./searchToResource.ts`** - canonical wiring file; copy this shape for new journeys.
3. **`./searchToResource.test.ts`** - canonical test shape.
4. **`./__test-utils__/journeyTestHarness.ts`** - the only legitimate way to mock the tracker in unit tests.

Public framework types live in **`@grafana/runtime`** (`packages/grafana-runtime/src/services/JourneyTracker.ts`):

- `registerJourneyTriggers` - registers the start condition (called once at module import).
- `onJourneyInstance` - registers the per-instance end-condition handler (also called once at module import).
- `JourneyMeta` - registry entry (type, description, owner, timeoutMs, optional `parents`).
- `JourneyHandle` - per-instance handle: `recordEvent`, `startStep`, `setAttributes`, `end(outcome)`.

Never import from `JourneyTrackerImpl` or `JourneyRegistryImpl` directly - those are internal.

## Adding a New Journey: Recipe

This is the short version of `journey-tracking.md` Steps 0-7. Read the full version if anything's unclear.

### 1. Decide the journey shape

- **Type name**: `snake_case` verb-object (`alert_rule_save`, `panel_edit`).
- **Owner**: the squad whose telemetry this is (`grafana-dashboards`, `grafana-alerting`, …).
- **Timeout**: how long is "still going" plausible for? Default 5 min; multi-hour flows (datasource setup) use longer.
- **Parents** (optional): other journey types that should nest under (set `parents: ['parent_type']`). When the parent is active at start, the child's span nests in the parent's trace.

### 2. Identify or add interactions

The framework subscribes to `reportInteraction` events via `onInteraction(name, callback)`. Check what the relevant code already emits:

```bash
grep -rn 'reportInteraction(' public/app/features/<your-area>/
```

If the events you need don't exist, add them. **Use `silent: true`** for new pure-CUJ events that shouldn't pollute analytics:

```ts
reportInteraction('grafana_<area>_<verb>', { ...attrs }, { silent: true });
```

### 3. Register metadata

Add an entry to `journeyRegistry.ts`:

```ts
{
  type: 'alert_rule_save',
  description: 'User edits and saves an alert rule',
  owner: 'grafana-alerting',
  timeoutMs: 10 * 60_000,
  // parents: ['some_parent_type'],  // optional
},
```

### 4. Create the wiring file

Path: `public/app/core/journeys/<camelCase>.ts`. Follow `searchToResource.ts` exactly:

```ts
import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';
import { collectUnsubs, str } from './utils';

/**
 * Journey: <type>
 * <one-line description of what the journey covers>
 *
 * Start triggers: <which interaction(s) start it>
 * Steps (duration): <list>      // optional
 * Events (point-in-time): <list> // optional
 * End conditions:
 *   - success: <which interaction>
 *   - discarded / canceled / abandoned: <which interaction>
 *   - timeout: 60s / 5min / etc.
 */

registerJourneyTriggers('<type>', (tracker) => {
  return onInteraction('<start_event>', (props) => {
    if (!tracker.getActiveJourney('<type>')) {
      tracker.startJourney('<type>', { attributes: { ... } });
    }
  });
});

onJourneyInstance('<type>', (handle) => {
  const { add, cleanup } = collectUnsubs();
  // wire steps + end conditions; each onInteraction handler call goes through `add(...)`
  return cleanup;
});
```

Use the `str(value)` helper for any value going into attributes - it coerces undefined / objects to a safe string.

### 5. Import at bootstrap

Add the import to `public/app/app.ts`:

```ts
await Promise.all([
  // ...existing imports...
  import('./core/journeys/<camelCase>'),
]);
```

### 6. Write tests

Path: `public/app/core/journeys/<camelCase>.test.ts`. Copy the shape of `searchToResource.test.ts`. Cover:

- start condition fires with right attributes
- each step / event handler fires correctly
- each end condition (success, discarded, etc.) ends the journey with the right outcome
- doesn't double-start when journey is active
- ignores irrelevant interactions

Run: `yarn jest --no-watch <camelCase>.test.ts`.

### 7. Verify locally

Enable the toggle + Faro (see `journey-tracking.md` Configuration section). Walk the workflow with `localStorage.setItem('grafana.debug.journeyTracker', 'true')` set. Confirm in console: `startJourney`, step events, `end` with right outcome.

For automated load: see `./searchToResource.smoke.ts` for the optional smoke driver pattern (runs the journey N times via Playwright).

## Pre-merge Checklist

- [ ] Registry entry has owner, description, sensible `timeoutMs`.
- [ ] Wiring file follows the `searchToResource.ts` shape (no module-scope `StepHandle` that outlives a journey - keep duration-step bookkeeping inside `onJourneyInstance`'s closure).
- [ ] All `onInteraction` subscriptions inside `onJourneyInstance` are tracked through `collectUnsubs` so cleanup runs on journey end.
- [ ] Tests cover start, every end condition, and at least one negative case.
- [ ] Bootstrap import added to `app.ts`.
- [ ] If you added new `reportInteraction` calls purely for CUJ purposes, they pass `{ silent: true }`.
- [ ] If parent nesting is intended, parent's `type` listed in `parents: [...]`.
- [ ] PR titles + commits scoped to the squad area, not pan-CUJ.

## Common Mistakes

- **Module-scope step handles**. Causes step leak across journey instances. Always store `StepHandle` in the `onJourneyInstance` closure.
- **Forgetting `add(...)` around an `onInteraction` subscription**. The unsubscribe is lost; subscriptions outlive the journey.
- **Using `recordEvent` for things that have a duration**. Use `startStep` + `step.end()` for measured operations; `recordEvent` is point-in-time.
- **Not handling the discarded path**. A journey that only ends on success will time out for the abandoned case - explicitly map "user closed without selecting" to `handle.end('discarded')`.
- **Polluting analytics**. New CUJ-only events should be `silent: true`. Existing analytics events (`command_palette_action_selected`, etc.) stay un-silent because they have independent value.

## Smoke Driver (optional)

Each journey can ship a Playwright smoke driver that exercises it against local Grafana. Pattern: a `<camelCase>.smoke.ts` file alongside the wiring that exports a `JourneyDriver`. Shared helpers (typing patterns, activation styles, palette open) live in `./__smoke__/`. The orchestrator in `scripts/cuj-smoke.ts` imports and registers each driver. See `searchToResource.smoke.ts` for the canonical example.

Smoke files import each other with explicit `.ts` extensions (Node ESM requirement) and live under their own `tsconfig.smoke.json`. Validate with `yarn typecheck:smoke` (also runs in CI + lefthook on relevant file changes).
