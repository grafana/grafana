---
name: add-e2e-selectors
description: Add reliable @grafana/e2e-selectors to interactive elements and key containers in the Grafana frontend. Use when adding e2e selectors, data-testid attributes, or test selectors to React components, when a file or component lacks selectors for testing, or when asked to make elements testable. Defines versioned selectors in the e2e-selectors package and wires data-testid into JSX. Accepts an optional target (a file path, directory, or the current/open file); scans the whole project when no target is given.
---

# Add e2e-selectors

Find interactive elements and key containers in the Grafana frontend that lack a stable test
selector, define a **versioned** selector in the `@grafana/e2e-selectors` package, and wire it
into the JSX as `data-testid`. This encodes the package's layout (`pages` vs `components`), its
semver versioning scheme, and its strict reuse / never-delete rules so selectors are added
correctly and don't break plugin end-to-end tests.

## Resolve the target

Interpret the argument to decide scope:

- **A file path** → only that file.
- **A directory** → all `.tsx` files under it.
- **"current file" / "open file" / no path but a file is open** → the open file.
- **No argument** → the whole frontend (`public/app/`, `packages/grafana-ui/src/`). Work
  file-by-file and summarize at the end; don't try to do everything in one pass.

## Step 1 — Find the version key

All new selectors added in this run use a single version key: the current `main` version with
`-pre` and build tags stripped.

```bash
git show main:package.json | awk -F'"' '/"version": ".+"/{ print $4; exit; }'
```

`13.2.0-pre` → use `'13.2.0'`. If you know the change will be backported, use the lowest
release version instead. Never hardcode — always compute it.

## Step 2 — Identify elements

Target these in the file:

- **Interactive controls** a test would click or type into: `button`, `input`, `select`,
  `textarea`, `a`, links, toggles/switches, checkboxes, radios, menu items, tabs, and the
  grafana-ui components that render them (`Button`, `IconButton`, `Input`, `Select`, `Switch`,
  `Checkbox`, `Tab`, etc.).
- **Key containers** tests scope queries to: modals, panels, page sections, dialogs.

Skip any element that already has a `data-testid` or an existing selector — don't duplicate.

### Loop rule (important)

Inside a `.map()` / list render, **do not** put a selector on each inner interactive element —
that bloats the DOM and degrades render performance. Instead attach **one parameterized
container selector to the repeated row/wrapper**, keyed by a unique value. Tests then scope
their queries within the matched row.

Canonical example —
`public/app/features/browse-dashboards/components/DashboardsTree.tsx`:

```tsx
<div
  key={key}
  {...rowProps}
  data-testid={selectors.pages.BrowseDashboards.table.row(
    'title' in dashboardItem ? dashboardItem.title : dashboardItem.uid
  )}
>
  {row.cells.map((cell) => /* inner cells get NO individual selector */)}
</div>
```

## Step 3 — Reuse check (never duplicate)

Before defining anything, search the package for an existing selector covering this UI:

```bash
grep -rn "<keyword>" packages/grafana-e2e-selectors/src/selectors/components.ts packages/grafana-e2e-selectors/src/selectors/pages.ts
```

If you're modifying UI that **already has** a selector, reuse it — creating a new one breaks
plugin e2e tests. Only create a new selector for genuinely new UI.

## Step 4 — Confirm the element accepts a selector prop

Before defining a selector for an element, confirm the target can actually receive it:

- **Plain DOM elements** (`div`, `button`, `input`, `a`, …) always accept `data-testid` — proceed.
- **grafana-ui / React components** only accept it if the component is written to forward it.
  Open the component and check that it either spreads remaining props onto the rendered DOM
  (`{...rest}` / `{...otherProps}` extending an `HTMLAttributes` type) **or** exposes a dedicated
  prop for the test id (e.g. grafana-ui's `Menu.Item` uses a `testId` prop, not `data-testid`).
  Use whichever the component actually supports.

If the component accepts **neither** `data-testid` nor an equivalent prop, **stop for that
element** and surface it to the user — name the component, the file, and that it doesn't forward
a test id. **Do not** add a new prop, spread, or otherwise modify an existing component to make
it accept one. Move on to the remaining elements and report the skipped one in your summary.

## Step 5 — Define the selector

- **Where:** `packages/grafana-e2e-selectors/src/selectors/components.ts` for reusable
  components; `pages.ts` for page-/screen-level elements and URLs.
- **Group:** nest under an existing group that mirrors the UI hierarchy, or add a new group
  named after the component/page.
- **Shape:** a versioned object whose key is the version from Step 1 and whose value is
  prefixed `data-testid ` (the prefix tells the framework to match the `data-testid`
  attribute rather than an aria-label):

```typescript
MyComponent: {
  submitButton: {
    '13.2.0': 'data-testid MyComponent submit button',
  },
},
```

- **Key naming.** Keys form a public API plugins depend on, so name them deliberately:
  - **Casing:** use **PascalCase** for a group key that names a distinct UI unit — a component,
    form, modal, or drawer (`NewFolderForm`, `MoveModal`, `CreateNewButton`); mirror the
    component name. Use **camelCase** for conceptual/functional groups that aren't a single named
    component (`table`, `actions`, `emptyState`) **and for every leaf element key**
    (`submitButton`, `searchInput`, `selectAllCheckbox`).
  - **Name leaf keys by role, not by visible label** — `moveButton`, never `move` or `Move`. This
    survives copy changes and reads unambiguously as a control.
  - **The markup drives the name — check the element itself, not its neighbours.** The role
    encoded in the key must match what the element actually renders. Use `…Button` only for
    something that renders/behaves as a button (a `<button>`, `Button`, or a `MenuItem` with
    `onClick` and no `url`); use `…Link` for something that navigates (an `<a>`, `LinkButton`, or
    `MenuItem` with `url`/`href`); use the matching role for inputs, checkboxes, etc. A suffix that
    contradicts the markup — or one carried over from a differently-rendered element nearby — is
    the defect. A single menu can legitimately contain both buttons and links, so their keys
    _should_ differ (`newDashboardLink` next to `newFolderButton`); that is correct, not an
    inconsistency to flatten.
  - **Same markup ⇒ same name, everywhere in the run — not just within one group.** Two controls
    with the same markup/role are the same kind of thing and must be named identically wherever
    they appear, across sibling keys _and_ across groups. Two dropdown-trigger buttons must both be
    `triggerButton` — not `triggerButton` in one group and `button` (or `createNewButton`) in
    another; two action `MenuItem`s must both be `…Button` — not `moveButton` next to bare
    `managePermissions`. The usual cause of a violation is naming each group in isolation and
    reaching for whatever reads locally; before finalizing, look across the whole file for other
    instances of the same control and reuse that name.
  - **Key ↔ value agreement.** The role word in the key must match the tail of its value: key
    `moveButton` ⇒ value `… move-button`; key `move` ⇒ value `… move`. A mismatch (key says
    `moveButton`, value ends `…-move`) is a reliable signal the key is wrong — reconcile them.

- **Prefer string selectors.** Use a **function selector only for genuinely parametric IDs**
  (loop/row keys, dashboard UIDs):

```typescript
table: {
  row: {
    '13.2.0': (id: string) => `data-testid BrowseDashboards table row ${id}`,
  },
},
```

- **Never edit or delete an existing entry.** To change an existing selector's value, add a
  **new version key** alongside the old one and keep the signature backwards compatible.

- **Ensure each new testid value is unique.** The string value (the part after the `data-testid `
  prefix) must not already exist anywhere in the package, or tests will match the wrong element.
  Check before committing to a value:

  ```bash
  grep -rn "MyComponent submit button" packages/grafana-e2e-selectors/src/selectors/
  ```

  Expect **zero** matches other than the entry you just added. Also confirm the new values are
  unique against each other within this run. If a value collides, pick a more specific one
  (include the component/page name and the element's role).

## Step 6 — Apply in JSX

Ensure the import exists (add it if missing):

```tsx
import { selectors } from '@grafana/e2e-selectors';
```

Then wire the attribute:

```tsx
// static control
<Button data-testid={selectors.components.MyComponent.submitButton} onClick={onSubmit}>
  Save
</Button>

// parameterized loop-row container
<div data-testid={selectors.pages.BrowseDashboards.table.row(item.uid)} />
```

Many grafana-ui components forward a `data-testid` prop, so passing it directly works; for
plain DOM elements set the attribute literally.

## Examples

```tsx
// Static selector on a control — Drawer close button
<IconButton data-testid={selectors.components.Drawer.General.close} onClick={onClose} />

// Parameterized selector for a repeated item — Tab title
<button data-testid={selectors.components.Tab.title(label)}>{label}</button>

// Page-level container selector
<div data-testid={selectors.pages.Explore.General.container}>{children}</div>
```

## Rules checklist

- Never delete a selector — external plugins depend on them.
- Reuse the existing selector when touching UI that already has one; only create for new UI.
- Confirm the element accepts `data-testid` or an equivalent prop before defining a selector; if
  it doesn't, surface it to the user and never add a prop to an existing component.
- Every new testid value must be unique across the package and within this run.
- Prefer string selectors; function selectors only for parametric loop/row/UID values.
- Name a key's role to match the element's actual markup (`…Button` for buttons, `…Link` for
  navigation, etc.) — never carry it over from a differently-rendered neighbour; keep the key's
  role word in sync with its value.
- Same markup ⇒ same name everywhere in the run — name equivalent controls identically across
  sibling keys and across groups (e.g. every dropdown trigger is `triggerButton`); scan the whole
  file for existing instances before naming a new one.
- New selectors use the version key from Step 1 (no `-pre`/build tags).
- To change a value, add a new version key — don't edit the old value or change the signature.
- In loops, selector goes on the row/container, not each inner element.

See `packages/grafana-e2e-selectors/src/selectors/README.md` and
`contribute/style-guides/e2e-playwright.md` for the authoritative guidance.

## Verify

- `yarn typecheck` — confirms the selector path and any function signature resolve.
- Selectors are resolved at runtime by the package's resolver; **no codegen step** is needed
  after editing `components.ts` / `pages.ts`.
- Optionally `yarn lint` the changed files.
