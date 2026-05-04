# SQL Abstraction Prototype — Dev Notes

## What was built

Two mid-fidelity prototypes gated behind the `sqlAbstractionPrototype` feature flag:

1. **Panel Editor SQL mode** — Classic/SQL toggle in the editor toolbar, SQL workbench layout (sources sidebar, CodeMirror-powered editor, results table, summary stats + sparkline).
2. **Dashboard AI panel** — Demo dashboard page at `/dashboard/sql-prototype` with an AI prompt panel and "Ask AI" sidebar in the panel options pane.

---

## Deviations & trade-offs

### Monaco instead of CodeMirror 6

The plan specified CodeMirror 6. Monaco Editor (`@monaco-editor/react`) is already in the repo and used by other editors, so we reused it via Grafana's `<CodeEditor>` wrapper from `@grafana/ui`. This saved ~6 new npm dependencies and integrates natively with Grafana themes.

The `native(...)` decoration is implemented via `editor.createDecorationsCollection` with a CSS class injected into `document.head`. Monaco doesn't support the same "ViewPlugin" model as CM6, but the visual result is identical: a purple/indigo tinted background on the native block, with PromQL completions activated inside it.

### Autocomplete side effect

The Monaco `registerCompletionItemProvider` call in `SqlEditor.tsx` registers globally for the `sql` language. In production this would clash with other SQL editors in Grafana. The fix is to scope via a custom language ID (e.g. `grafana-sql-proto`). Flagged here — not an issue for demo purposes.

### PanelEditorState extension

Added `sqlPrototypeMode?: 'classic' | 'sql'` to `PanelEditorState` (a Scenes `SceneObjectState`). This is prototype-only state and should be cleaned up before any real extraction. Adding it to the Scenes object was the simplest way to share state between the toolbar toggle (`PanelEditControls`) and the renderer (`PanelEditorRenderer`) without a React context.

### Ask AI in PanelOptionsPane

`AiPanelSidebar` is injected directly at the top of `PanelOptionsPaneComponent` behind a feature flag check. This avoids modifying the `PanelOptionsPane` class and its Scenes state but does add an import to a file that has nothing to do with AI. A cleaner approach would be a plugin slot / extension point, or a new pane component that wraps `PanelOptionsPane`.

### No real route guard

The `/dashboard/sql-prototype` route is not gated by a route-level feature flag check — the flag check happens inside the component. This means the route exists in all builds. Gating at the route level would require adding to `DashboardRoutes` and passing a flag condition to the route descriptor.

### Dashboard prototype is standalone

The dashboard prototype at `/dashboard/sql-prototype` is a standalone React component, not a real Grafana dashboard JSON loaded via the Scenes engine. The panels are mocked in-memory. This is intentional for the prototype (no backend required) but means:
- The "Add AI panel" affordance (plan section 6.4) is not implemented — the demo dashboard pre-includes the AI panel.
- Panel state does not persist.

---

## Things to clean up before shipping

1. **Remove `registerCompletionItemProvider` side effect** — use a dedicated Monaco language ID.
2. **Move `sqlPrototypeMode` out of `PanelEditorState`** — use a URL param or local storage, or a dedicated prototype context.
3. **Delete the route and prototype page** — or promote to a real Scenes-based dashboard.
4. **Remove the `AiPanelSidebar` import from `PanelOptionsPane.tsx`** — it leaks a prototype dependency into a core file.
5. **The `native()` CSS injection** uses `document.head.appendChild` — in production, use Emotion's `Global` component or a CSS module.
6. **Feature flag** was manually added to `toggles_gen.go`, `registry.go`, and `featureToggles.gen.ts`. Running `make gen-feature-toggles` would regenerate the first two files but not the TS type. The TS type file should be generated too (it's in `packages/grafana-data`).

---

## How to enable

Add to `conf/custom.ini`:

```ini
[feature_toggles]
sqlAbstractionPrototype = true
```

Then restart the backend (`make run`). No frontend restart needed — the toggle is read at page load.
