# Create dashboard from existing — Design

**Date:** 2026-06-03
**Status:** Approved (design)
**Scope:** Frontend only. No backend changes.

## Problem

Today, creating a new dashboard based on an existing one requires manually
copying the dashboard JSON and importing it. We want a first-class entry point:
a **"Create from existing"** action that lets a user search for a dashboard and
land in the new-dashboard editor with that dashboard's full structure
pre-loaded, ready to edit and save as a brand-new dashboard.

## User flow

1. User opens the "New" menu (browse Dashboards page **or** the global top-nav
   `+` button).
2. User selects **"Create from existing"**.
3. A modal opens with a dashboard search field (search by name).
4. User types a name; matching dashboards appear.
5. User clicks a result.
6. User is redirected to the new-dashboard editor, already populated with the
   selected dashboard's layout/panels/variables, as an **unsaved, dirty draft**.
7. User edits as desired and explicitly Saves, which creates a new dashboard.

## Decisions

| Decision                  | Choice                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| End state after selection | **Unsaved draft** (`isNew`, dirty) — user saves explicitly                                           |
| What is copied            | **Everything**: panels, layout, variables, annotations, queries, datasource refs, dashboard settings |
| Entry points              | **Both** the browse-page `CreateNewButton` and the top-nav `QuickAdd` menu                           |
| Handoff mechanism         | **Query-param deep-link** on a dedicated route `/dashboard/new-from-existing?sourceUid=<uid>`        |
| Draft title               | `"<source title> Copy"`                                                                              |
| Feature toggle            | **None** — always on                                                                                 |

## Architecture

The feature composes existing infrastructure; the only genuinely new logic is a
clone-and-strip-identity function. Each unit below has a single purpose.

### 1. Selection modal (new component)

- A small modal component (e.g. `CreateFromExistingModal`) wrapping the existing
  reusable [DashboardPicker](../../../public/app/core/components/Select/DashboardPicker.tsx)
  (`AsyncSelect` backed by `getGrafanaSearcher().search({ kind: ['dashboard'] })`).
- On selection, it navigates to
  `/dashboard/new-from-existing?sourceUid=<uid>` (appending `&folderUid=<uid>`
  when the menu was opened within a folder context).
- The modal is "dumb": it only selects a dashboard and navigates. It performs no
  loading or cloning itself.

### 2. Menu items (two entry points)

- **Browse page:** add a "Create from existing" item to
  [CreateNewButton.tsx](../../../public/app/features/browse-dashboards/components/CreateNewButton.tsx),
  alongside "New dashboard" / "Import" / "New folder". It opens the modal
  (passing the current `folderUid` if present).
- **Top-nav:** add the corresponding entry so it appears in
  [QuickAdd](../../../public/app/core/components/AppChrome/QuickAdd/QuickAdd.tsx).
  Register its icon (`copy`) in
  [QuickAdd/utils.ts](../../../public/app/core/components/AppChrome/QuickAdd/utils.ts)
  `ITEM_ICONS`.
- Note: QuickAdd items are typically sourced from the backend nav tree
  (`isCreateAction`). During implementation, confirm whether this item is added
  via the nav tree or rendered directly; follow whichever pattern the existing
  "Import" item uses so both menus stay consistent.

### 3. Route

- Add `DashboardRoutes.NewFromExisting` to
  [public/app/types/dashboard.ts](../../../public/app/types/dashboard.ts).
- Add a route in [routes.tsx](../../../public/app/routes/routes.tsx) for
  `/dashboard/new-from-existing` → `DashboardPageProxy` → `DashboardScenePage`,
  guarded by the same `DashboardsCreate` permission as `/dashboard/new`. This
  mirrors the existing `/dashboard/new-with-ds/:datasourceUid` convention.

### 4. Load + clone (core logic)

- In
  [DashboardScenePageStateManager.ts](../../../public/app/features/dashboard-scene/pages/DashboardScenePageStateManager.ts)
  `fetchDashboard()`, add a `NewFromExisting` case (next to the existing `New`
  case). It reads `sourceUid` (and optional `folderUid`) from the URL params and
  calls a new builder.
- New `buildFromExistingDashboardSaveModel(sourceUid, folderUid?)` in
  [buildNewDashboardSaveModel.ts](../../../public/app/features/dashboard-scene/serialization/buildNewDashboardSaveModel.ts),
  mirroring `buildNewDashboardSaveModel`:
  1. `getDashboardAPI().getDashboardDTO(sourceUid)` to fetch the full source DTO.
  2. **Strip identity**: clear `uid`, `id`, `version`, and save metadata
     (`created`, `updated`, etc.).
  3. Set `meta.isNew = true`, `canStar/canShare/canDelete = false`, apply target
     `folderUid`, and set `title = "<source title> Copy"`.
  4. Keep everything else (panels, layout, templating/variables, annotations,
     time settings, tags).
  5. Return a `DashboardDTO` in the same shape the empty-new path returns, so the
     downstream scene transform is unchanged.

### 5. Editor state

- Reuse the **template-route treatment** already present in
  `transformResponseToScene` (`setInitialSaveModel` + `onEnterEditMode()` +
  `isDirty: true`) for the `NewFromExisting` case, so the user lands in edit mode
  with an unsaved dirty draft and must explicitly Save.
- Saving routes through the normal new-dashboard save path
  (`useSaveDashboard` / `getSaveAsModel` semantics), creating a brand-new
  dashboard with a fresh UID.

### 6. i18n

- Add the "Create from existing" label and modal strings to the appropriate
  locale file (and `tempI18nPhrases.ts` if the search/menu area requires it).

## Data flow

```
New menu ("Create from existing")
  -> CreateFromExistingModal (DashboardPicker search)
     -> navigate /dashboard/new-from-existing?sourceUid=UID[&folderUid=FID]
        -> DashboardScenePage -> StateManager.fetchDashboard(NewFromExisting)
           -> buildFromExistingDashboardSaveModel(UID, FID)
              -> getDashboardDTO(UID) -> strip identity -> isNew DTO
           -> transformResponseToScene (template treatment: edit mode, dirty)
        -> Dashboard editor (unsaved draft, title "<source> Copy")
  -> user edits -> Save -> new dashboard created (new UID)
```

## Files to touch

| File                                                                              | Change                                                               |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `public/app/types/dashboard.ts`                                                   | Add `DashboardRoutes.NewFromExisting`                                |
| `public/app/routes/routes.tsx`                                                    | Add `/dashboard/new-from-existing` route                             |
| `public/app/features/dashboard-scene/pages/DashboardScenePageStateManager.ts`     | Add `NewFromExisting` fetch case + template-style scene treatment    |
| `public/app/features/dashboard-scene/serialization/buildNewDashboardSaveModel.ts` | Add `buildFromExistingDashboardSaveModel()`                          |
| `public/app/features/browse-dashboards/components/CreateNewButton.tsx`            | Add menu item + open modal                                           |
| `public/app/core/components/AppChrome/QuickAdd/utils.ts`                          | Register `copy` icon for the new action                              |
| QuickAdd integration                                                              | Add the new-action entry (via nav tree or direct, matching "Import") |
| New: `CreateFromExistingModal` component                                          | Modal wrapping `DashboardPicker`, navigates on select                |
| Locale / `tempI18nPhrases.ts`                                                     | New strings                                                          |

## Open implementation considerations

- **v1 vs v2 schema:** `getDashboardDTO` may return a v1 or v2 dashboard.
  `buildFromExistingDashboardSaveModel` must strip identity correctly for
  whichever version is returned and produce a DTO the scene transform accepts.
  Reuse the same version handling the existing load path uses; do not introduce
  bespoke version branching beyond what is necessary to clear identity fields.
- **Datasource references:** copied panels keep their original datasource refs.
  This is intentional (full clone). No datasource remapping is in scope for this
  feature.
- **Permissions:** the source must be readable by the user; the new draft uses
  the standard create permission. The picker already only surfaces dashboards the
  user can see.

## Testing plan

- **Unit:** `buildFromExistingDashboardSaveModel` — given a source DTO, returns a
  DTO with identity stripped, `isNew: true`, title suffixed `" Copy"`, target
  `folderUid` applied, and all panels/variables/annotations preserved.
- **Unit/component:** StateManager `NewFromExisting` case calls the builder with
  params parsed from the URL and applies the dirty/edit-mode treatment.
- **Component:** `CreateNewButton` and `QuickAdd` render the new item; clicking
  opens the modal.
- **Component:** `CreateFromExistingModal` — selecting a dashboard navigates to
  the correct URL (with and without `folderUid`).
- **Manual/E2E:** full flow — open menu, search, select, verify the editor shows
  the cloned layout as an unsaved draft titled "<source> Copy", edit, save, and
  confirm a new dashboard with a new UID is created and the source is untouched.

## Out of scope

- Backend changes (none required).
- Feature-toggle gating (explicitly not used; always on).
- Datasource remapping / input substitution (full clone keeps original refs).
- Selecting a subset of panels to copy.
