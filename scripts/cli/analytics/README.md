# Analytics Framework

## What is the analytics framework?

The analytics framework is a typed, self-documenting system for defining and tracking product analytics events in Grafana. It is built around `defineFeatureEvents`, a factory exported from `@grafana/runtime/internal`, which produces strongly-typed event reporters. Events defined with this factory are automatically discoverable by the report script in this folder.

The framework has two parts:

- **Runtime** (`packages/grafana-runtime/src/internal/analyticsFramework/main.ts`): the `defineFeatureEvents` factory and the `EventProperty` type that all event property interfaces must extend.
- **Script** (`scripts/cli/analytics/`): a static analysis tool that reads the TypeScript source, finds every event defined with the factory, and generates a human-readable report.

---

## Purpose

The framework ensures that:

- Every event has a **consistent naming convention** (`{repo}_{feature}_{eventName}`, e.g. `grafana_dashboard_library_loaded`).
- Every event has a **description** (enforced by the ESLint rule `define-feature-events`).
- Every event property has a **JSDoc comment** describing what it captures (also enforced by the ESLint rule).
- The full catalogue of events and their schemas can be **generated automatically** without manual maintenance.

---

## How to define events

### 1. Create the factory

Call `defineFeatureEvents` with two required string literals — the repo name and the feature name — and an optional object of default properties that are merged into every event fired through this factory:

```ts
import { defineFeatureEvents } from '@grafana/runtime/internal';

const SCHEMA_VERSION = 1;

const newMyFeatureEvent = defineFeatureEvents('grafana', 'my_feature', {
  /** Version of the event schema, used to handle breaking changes in the properties contract. */
  schema_version: SCHEMA_VERSION,
});
```

This produces event names of the form `grafana_my_feature_{eventName}`.

### 2. Define the property interfaces

Create a `types.ts` file next to your events file. Each interface must extend `EventProperty` from `@grafana/runtime/internal`, and every property must have a JSDoc comment:

```ts
import { type EventProperty } from '@grafana/runtime/internal';

export interface LoadedProperties extends EventProperty {
  /** Total number of items visible at load time. */
  numberOfItems: number;
  /** Plugin IDs of data sources referenced by the loaded items. */
  datasourceTypes: string[];
}
```

### 3. Export the events object

Create a `main.ts` (or similar) and export a `const` object grouping related events. Each entry must have a JSDoc comment describing when it fires:

```ts
import { defineFeatureEvents } from '@grafana/runtime/internal';
import { type LoadedProperties } from './types';

const newMyFeatureEvent = defineFeatureEvents('grafana', 'my_feature', {
  /** Version of the event schema. */
  schema_version: 1,
});

/**
 * Analytics events for My Feature.
 */
export const MyFeatureInteractions = {
  /** Fired when the feature finishes loading and its content is visible. */
  loaded: newMyFeatureEvent<LoadedProperties>('loaded'),

  /** Fired when the user clicks an item in the list. */
  itemClicked: newMyFeatureEvent<ItemClickedProperties>('item_clicked'),
};
```

The exported object can also extend another interactions object using the spread operator. Direct property assignments override spread entries with the same event name, mirroring JavaScript spread semantics:

```ts
export const MyVariantInteractions = {
  ...MyFeatureInteractions,
  /** Fired when the variant-specific list finishes loading. */
  loaded: newMyFeatureEvent<LoadedProperties>('loaded'),
};
```

---

## How to call events

Import the exported interactions object and call the method when the action occurs:

```ts
import { MyFeatureInteractions } from './analytics/main';

// In a React component or handler:
MyFeatureInteractions.loaded({ numberOfItems: 42, datasourceTypes: ['prometheus'] });
MyFeatureInteractions.itemClicked({ itemId: 'abc', itemTitle: 'My dashboard' });
```

Each call internally calls `reportInteraction` from `@grafana/runtime`, forwarding all properties plus any default properties defined on the factory (e.g. `schema_version`).

---

## How to generate the report

Run the following command from the repo root:

```bash
yarn analytics-report
```

This runs `scripts/cli/analytics/main.mts` using `ts-morph` to statically analyse every `.ts` source file. It finds all calls to `defineFeatureEvents`, resolves every event and its TypeScript property types, and writes the result to `analytics-report.md` in the repo root.

The script does not execute application code — it reads the TypeScript AST directly, so no build step is required.

---

## What the report looks like

The output is a Markdown file (`analytics-report.md`) grouped by feature. Each event section contains:

- **Full event name** — the complete string sent to the analytics backend (e.g. `grafana_dashboard_library_loaded`).
- **Description** — taken from the JSDoc comment on the event entry.
- **Owner** — resolved automatically from `.github/CODEOWNERS` based on which file declares the event.
- **Properties table** — every property with its TypeScript type (resolved to primitive/union form) and its JSDoc description. Default properties (e.g. `schema_version`) are included and listed first.

Example:

```markdown
# Analytics report

## dashboard_library

### 1: _grafana_dashboard_library_loaded_

**Description**: Fired when the library panel finishes rendering and its items are visible.

**Owner:** @grafana/dashboards

**Properties**:

| name            | type       | description                                                |
| --------------- | ---------- | ---------------------------------------------------------- |
| schema_version  | `number`   | Version of the event schema.                               |
| numberOfItems   | `number`   | Total number of items visible in the library at load time. |
| datasourceTypes | `string[]` | Plugin IDs of data sources referenced by the loaded items. |
```
