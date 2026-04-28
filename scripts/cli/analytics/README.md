# Analytics Framework

## What is the analytics framework?

The analytics framework is a typed, self-documenting system for defining and tracking product analytics events in Grafana. It is built around `defineFeatureEvents`, a factory exported from `@grafana/runtime/internal`, which produces strongly-typed event reporters. Events defined with this factory are automatically discoverable by the report script in this folder.

The framework is split into two parts with distinct responsibilities:

- **Framework library** (`packages/grafana-runtime/src/internal/analyticsFramework/`): production code that ships with Grafana. It exports the `defineFeatureEvents` factory and the `EventProperty` base type.
- **Report generator** (`scripts/cli/analytics/`): a developer tool that runs offline and is never bundled with the application. It reads the TypeScript AST to find every event declared with the factory and writes a human-readable catalogue.

The framework ensures that:

- Every event has a **consistent naming convention** (`{repo}_{feature}_{eventName}`, e.g. `grafana_dashboard_library_loaded`).
- Every event has a **description** (enforced by the ESLint rule `define-feature-events`).
- Every event property has a **JSDoc comment** describing what it captures (also enforced by the ESLint rule).
- Every event has a **code owner** assigned automatically, derived from `.github/CODEOWNERS` based on the file's location.
- The full catalogue of events and their schemas can be **generated automatically** without manual maintenance.

---

## How to define events

### 1. Define the property interfaces

Create a `types.ts` file next to your feature file (we encourage to create an 'analytics' folder within the feature one). Each interface must extend `EventProperty` from `@grafana/runtime/internal`, and every property must have a JSDoc comment:

```ts
import { type EventProperty } from '@grafana/runtime/internal';

export interface ThemeChanged extends EventProperty {
  /** Whether the preference being changed belongs to an org, team, or individual user. */
  preferenceType: 'org' | 'team' | 'user';
  /** The theme the user switched to. */
  toTheme: string;
}
```

### 2. Create the factory

Create the tracking event file next to `types.ts`.

Call `defineFeatureEvents` with two required string literal arguments — the repo name and the feature name. There is an optional third argument to set default properties (merged into every event in the namespace):

```ts
// Without default properties
const createPreferencesEvent = defineFeatureEvents('grafana', 'preferences');

// With default properties (e.g. a schema version sent with every event)
const createLibraryEvent = defineFeatureEvents('grafana', 'dashboard_library', {
  /** Version of the event schema, used to handle breaking changes in the properties contract. */
  schema_version: 1,
});
```

This produces event names of the form `grafana_{feature}_{eventName}`.

### 3. Declare the events

Events can be declared in two ways. Both are fully supported by the report script.

#### 3.1. Flat individual exports

Each event is exported as its own `const`. This works well for small, cohesive sets of events. The JSDoc comment above each export becomes its description in the report.

```ts
import { defineFeatureEvents } from '@grafana/runtime/internal';
import { type ThemeChanged, type LanguageChanged } from './types';

const createSharedPreferencesEvents = defineFeatureEvents('grafana', 'preferences');

/** Fired immediately when the user selects a new theme from the theme picker, before saving. */
export const themeChanged = createSharedPreferencesEvents<ThemeChanged>('theme_changed');

/** Fired immediately when the user selects a new language from the language picker, before saving. */
export const languageChanged = createSharedPreferencesEvents<LanguageChanged>('language_changed');
```

#### 3.2. Grouped object export

All events are collected into a single exported `const` object. This is useful for larger feature areas where events are used together. Each property of the object must have a JSDoc comment. The object can also spread another events object to inherit and override entries:

```ts
import { defineFeatureEvents } from '@grafana/runtime/internal';
import { type LoadedProperties, type ItemClickedProperties } from './types';

const newDashboardLibraryInteraction = defineFeatureEvents('grafana', 'dashboard_library', {
  /** Version of the event schema. */
  schema_version: 1,
});

/**
 * Analytics events for the Dashboard Library feature.
 */
export const NewDashboardLibraryInteractions = {
  /** Fired when the library panel finishes rendering and its items are visible. */
  loaded: newDashboardLibraryInteraction<LoadedProperties>('loaded'),
  /** Fired when the user selects an item from the library list. */
  itemClicked: newDashboardLibraryInteraction<ItemClickedProperties>('item_clicked'),
};

/**
 * Dashboard Library events scoped to the Template Dashboards variant.
 */
export const NewTemplateDashboardInteractions = {
  ...NewDashboardLibraryInteractions,
  /** Fired when the Template Dashboards view finishes loading. */
  loaded: newDashboardLibraryInteraction<LoadedProperties>('loaded'),
};
```

Direct property assignments override spread entries with the same event name, mirroring JavaScript spread semantics.

---

## Event file placement

Event files must live **inside the feature's own folder**, not in a shared or generic location. Ownership is resolved automatically from `.github/CODEOWNERS` using the file path, so placing events inside the feature folder is all that is needed — no manual owner tag required.

The recommended structure is:

```
public/app/features/my-feature/
  analytics/
    main.ts    ← factory + event declarations
    types.ts   ← EventProperty interfaces
  MyFeatureComponent.tsx
  ...
```

---

## How to fire events

Import the events and call them when the action occurs:

```ts
// Flat export
import { themeChanged } from './analytics/main';
themeChanged({ preferenceType: 'user', toTheme: 'dark' });

// Grouped object export
import { NewDashboardLibraryInteractions } from './analytics/main';
NewDashboardLibraryInteractions.loaded({ numberOfItems: 42, datasourceTypes: ['prometheus'] });
```

Each call internally invokes `reportInteraction` from `@grafana/runtime`, forwarding all properties plus any default properties defined on the factory (e.g. `schema_version`).

---

## How to generate the report

Run the following command from the repo root:

```bash
yarn analytics-report
```

This runs `scripts/cli/analytics/main.mts` using `ts-morph` to statically analyse every `.ts` source file. It finds all calls to `defineFeatureEvents`, resolves every event and its TypeScript property types, and writes the result to `analytics-report.md` in the repo root.

The script does not execute application code — it reads the TypeScript AST directly, so no build step is required.

Example:

```markdown
# Analytics report

## dashboard_library

### 1: _grafana_dashboard_library_loaded_

**Description**: Fired when the library panel finishes rendering and its items are visible.

**Owner:** @grafana/sharing

**Properties**:

| name            | type       | description                                                |
| --------------- | ---------- | ---------------------------------------------------------- |
| schema_version  | `number`   | Version of the event schema.                               |
| numberOfItems   | `number`   | Total number of items visible in the library at load time. |
| datasourceTypes | `string[]` | Plugin IDs of data sources referenced by the loaded items. |
```

The output is a Markdown file grouped by feature. Each event section contains:

- **Full event name** — the complete string sent to the analytics backend (e.g. `grafana_dashboard_library_loaded`).
- **Description** — taken from the JSDoc comment on the event entry.
- **Owner** — resolved automatically from `.github/CODEOWNERS` based on the path of the file that declares the events.
- **Properties table** — every property with its TypeScript type (resolved to primitive/union form) and its JSDoc description. Default properties (e.g. `schema_version`) are listed first.
