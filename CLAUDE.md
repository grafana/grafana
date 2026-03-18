@AGENTS.md

# Plan: Allow Admin Deletion of Orphaned Provisioned Resources

## Context

When a provisioning repository is improperly deleted, dashboards and folders retain `grafana.app/managedBy` and `grafana.app/managerId` annotations pointing to a non-existent repository. Users can **view** these resources but **cannot save, delete, or move** them — they see a generic "Error loading form" message. The goal is to let admin users **release** (strip manager annotations from) orphaned resources via the frontend, converting them back to normal editable resources. All users should see a warning; only admins can act. **Frontend-only changes.**

### How orphaned state is currently detected (and fails)

1. `DashboardScene.isManagedRepository()` returns `true` (annotations still present)
2. `useIsProvisionedNG()` returns `true` → routes to `SaveProvisionedDashboard`
3. `useProvisionedDashboardData` → `useGetResourceRepositoryView({ name: managerIdentity })`
4. In `useGetResourceRepositoryView` (line 95-106): `name` is set but `items.find()` returns `undefined` → falls through to line 138 returning `repository: instanceRepo` (or `undefined`)
5. Back in `useDefaultValues` (line 57): `!repository` check → returns `RepoViewStatus.Error` with "No repository found for this dashboard"
6. `SaveProvisionedDashboard` / `DeleteProvisionedDashboardDrawer` → renders `FormLoadingErrorAlert` with generic "Error loading form"

---

## 4 Proposed Solutions (Frontend-Only)

---

## Solution 1: Hook-Level Fix

**Philosophy**: Add a new `RepoViewStatus.Orphaned` status that propagates through existing hooks. Update existing error components to show orphan-specific UI.

### Changes

#### 1a. Add `Orphaned` to `RepoViewStatus` enum

**File**: `public/app/features/provisioning/hooks/useGetResourceRepositoryView.ts`

- Add `Orphaned = 'orphaned'` to enum
- After line 105 (when `name` is provided but no match found), add an `else` return:
  ```typescript
  if (name) {
    const repository = items.find((repo) => repo.name === name);
    if (repository) {
      /* existing */
    }
    // NEW: name specified but no match = orphaned
    return { folder, isInstanceManaged, isReadOnlyRepo: false, status: RepoViewStatus.Orphaned };
  }
  ```

#### 1b. Propagate orphaned status

**File**: `public/app/features/provisioning/hooks/useProvisionedDashboardData.ts`

- Add `isOrphaned: boolean` to `ProvisionedDashboardData` interface
- In `useDefaultValues`: handle `RepoViewStatus.Orphaned` before the `!repository` check
- In `useProvisionedDashboardData`: set `isOrphaned: repoDataStatus === RepoViewStatus.Orphaned`

#### 1c. Create `OrphanedDashboardAlert` component

**New file**: `public/app/features/provisioning/components/Dashboards/OrphanedDashboardAlert.tsx`

- Warning `Alert` explaining orphaned state (visible to all users)
- "Disconnect from repository" `Button` (admin-only, via `contextSrv.hasRole('Admin')`)
- `ConfirmModal` from `@grafana/ui` for confirmation
- On confirm: JSON PATCH to strip annotations, then `window.location.reload()`

#### 1d. Create `useReleaseOrphanedResource` hook

**New file**: `public/app/features/provisioning/hooks/useReleaseOrphanedResource.ts`

- Builds JSON Patch ops (`op: 'remove'`) for present annotations only
- Uses `getBackendSrv().fetch()` with `Content-Type: application/json-patch+json`
- Supports both dashboards and folders via `resourceType` param
- URL: `/apis/dashboard.grafana.app/v2beta1/namespaces/${ns}/dashboards/${name}`

#### 1e. Update consumers

**Files**: `SaveProvisionedDashboard.tsx`, `DeleteProvisionedDashboardDrawer.tsx`

- Before the error branch, add: `if (repoDataStatus === RepoViewStatus.Orphaned)` → render `OrphanedDashboardAlert`

### Pros

- Targeted fix at the data layer; new status is semantically clear
- Minimal new components (1 alert component + 1 hook)
- Error path unchanged for non-orphan errors

### Cons

- Only fixes save/delete drawers — doesn't fix the navbar badge or other downstream consumers
- Requires modifying a shared enum that other code may switch on
- Folder case requires separate integration work

---

## Solution 2: Banner + Drawer Approach

**Philosophy**: Create a standalone `OrphanedResourceBanner` shown inline on the dashboard/folder **page** itself (not just in save/delete drawers). Separate detection from action.

### Changes

#### 2a. Create `useIsOrphanedResource` hook

**New file**: `public/app/features/provisioning/hooks/useIsOrphanedResource.ts`

- Accepts `managerKind` and `managerIdentity`
- Calls `useGetFrontendSettingsQuery` to check if repo exists
- Returns `{ isOrphaned, isLoading }`
- Key detection: `managerKind === ManagerKind.Repo && managerIdentity && !items.some(r => r.name === managerIdentity)`

#### 2b. Create `useDisconnectOrphanedResource` hook

**New file**: `public/app/features/provisioning/hooks/useDisconnectOrphanedResource.ts`

- Same PATCH logic as Solution 1d, supporting dashboards and folders
- Uses merge-patch (`application/merge-patch+json`) with `null` values to remove annotations

#### 2c. Create `DisconnectOrphanedResourceModal` component

**New file**: `public/app/features/provisioning/components/Shared/DisconnectOrphanedResourceModal.tsx`

- `ConfirmModal` with destructive variant
- Explains what will happen
- Shows spinner during disconnect

#### 2d. Create `OrphanedResourceBanner` component

**New file**: `public/app/features/provisioning/components/Shared/OrphanedResourceBanner.tsx`

- Warning `Alert` shown on the page (not inside a drawer)
- All users see warning text
- Admins see "Disconnect from repository" button → opens modal

#### 2e. Create `OrphanedDashboardBanner` wrapper

**New file**: `public/app/features/provisioning/components/Dashboards/OrphanedDashboardBanner.tsx`

- Gets `DashboardScene`, extracts annotations, calls `useIsOrphanedResource`
- Renders `OrphanedResourceBanner` if orphaned
- `onDisconnected` → `window.location.reload()`

#### 2f. Integrate into `DashboardScenePage.tsx`

**File**: `public/app/features/dashboard-scene/pages/DashboardScenePage.tsx`

- Add `<OrphanedDashboardBanner dashboard={dashboard} />` alongside existing banners

#### 2g. Create `OrphanedFolderBanner` wrapper

**New file**: `public/app/features/provisioning/components/Folders/OrphanedFolderBanner.tsx`

- Same as 2e but for folders, using folder DTO

#### 2h. Integrate into `BrowseDashboardsPage.tsx`

**File**: `public/app/features/browse-dashboards/BrowseDashboardsPage.tsx`

- Add folder orphan banner

#### 2i. Update `ManagedDashboardNavBarBadge.tsx`

- When repo query returns no data for a repo-managed dashboard, show orange/red badge with "Repository not found" tooltip

### Pros

- Banner visible immediately on page load (not just when opening save/delete)
- Clean separation: detection hook, action hook, banner, modal — all reusable
- Works for both dashboards and folders
- Navbar badge also updated

### Cons

- Most new files (6+ new files)
- Does NOT fix the save/delete drawer error — those still show "Error loading form" (user must use banner first)
- Banner adds visual noise to the page

---

## Solution 3: Minimal Change Approach

**Philosophy**: Smallest possible diff. Modify existing components in-place — no new files except one small hook.

### Changes

#### 3a. Add `isOrphaned` to `useProvisionedDashboardData`

**File**: `public/app/features/provisioning/hooks/useProvisionedDashboardData.ts`

- Add `isOrphaned: boolean` to `ProvisionedDashboardData`
- In `useDefaultValues`, at the `!repository` check (line 57-63): set `isOrphaned: Boolean(managerKind && managerIdentity)`
- Thread through to `useProvisionedDashboardData` return

#### 3b. Enhance `FormLoadingErrorAlert`

**File**: `public/app/features/provisioning/components/Dashboards/FormLoadingErrorAlert.tsx`

- Add optional props: `isOrphaned?: boolean`, `onDisconnect?: () => void`, `isDisconnecting?: boolean`
- When `isOrphaned`: severity `warning` instead of `error`, title "Orphaned dashboard", descriptive body text, admin-only "Disconnect" button
- When not orphaned: unchanged behavior

#### 3c. Create `useDisconnectOrphanedDashboard` hook

**New file**: `public/app/features/provisioning/hooks/useDisconnectOrphanedDashboard.ts`

- Merge-patch call to strip annotations: `getBackendSrv().patch(url, { metadata: { annotations: { [key]: null } } }, { headers: { 'Content-Type': 'application/merge-patch+json' } })`
- ~25 lines total

#### 3d. Wire up in `SaveProvisionedDashboard` and `DeleteProvisionedDashboardDrawer`

**Files**: Both files

- Import `useDisconnectOrphanedDashboard`, `contextSrv`, `ConfirmModal`
- Pass `isOrphaned`, `onDisconnect` (admin-only), `isDisconnecting` to `FormLoadingErrorAlert`
- Add `ConfirmModal` for confirmation before disconnect
- After disconnect: `window.location.reload()`

### Pros

- **Smallest diff** — modifies 4 existing files + 1 new hook file
- Reuses existing `FormLoadingErrorAlert` component
- No new enum values, no new page-level components
- Fixes the exact user-facing problem (save/delete drawers show actionable UI instead of generic error)

### Cons

- Only fixes save/delete drawers — navbar badge unchanged, no page-level warning
- Duplicates some wiring between Save and Delete components
- Doesn't address folders

---

## Solution 4: Scene-Level Approach

**Philosophy**: Fix at the `DashboardScene` level so ALL downstream components automatically benefit. Orphaned dashboards are treated as non-provisioned.

### Changes

#### 4a. Add orphan state to `DashboardScene`

**File**: `public/app/features/dashboard-scene/scene/DashboardScene.tsx`

- Add `isOrphanedRepository: boolean` to `DashboardSceneState` (default `false`)
- Modify `isManagedRepository()`: return `false` when `isOrphanedRepository` is `true`
- Add `isOrphanedRepository()` getter method
- Add `disconnectFromRepository()` method: merge-patch to strip annotations, then update local state

#### 4b. Create `useOrphanedRepositoryDetection` hook

**New file**: `public/app/features/dashboard-scene/scene/useOrphanedRepositoryDetection.ts`

- Called from `DashboardSceneRenderer`
- Uses `useGetFrontendSettingsQuery` to check if manager identity repo exists
- If orphaned: calls `dashboard.setState({ isOrphanedRepository: true })`

#### 4c. Wire into `DashboardSceneRenderer`

**File**: `public/app/features/dashboard-scene/scene/DashboardSceneRenderer.tsx`

- Call `useOrphanedRepositoryDetection(model)` at the top

#### 4d. Update `useIsProvisionedNG`

**File**: `public/app/features/provisioning/hooks/useIsProvisionedNG.ts`

- Add: `if (dashboard.isOrphanedRepository()) { return false; }`
- This prevents routing to provisioned save/delete flows entirely

#### 4e. Create `OrphanedDashboardBadge` component

**New file**: `public/app/features/dashboard-scene/scene/OrphanedDashboardBadge.tsx`

- Orange `Badge` with "Orphaned" text and warning tooltip
- Admin-only "Disconnect" `Button`
- `ConfirmModal` for confirmation
- On confirm: calls `dashboard.disconnectFromRepository()`, then `window.location.reload()`

#### 4f. Update `ManagedDashboardNavBarBadge`

**File**: `public/app/features/dashboard-scene/scene/ManagedDashboardNavBarBadge.tsx`

- When `dashboard.useState().isOrphanedRepository` is true → render `OrphanedDashboardBadge` instead

### Cascade effect — everything else "just works":

| Component                               | Why it works                                                                |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `SaveDashboardDrawer`                   | `useIsProvisionedNG` returns `false` → routes to normal `SaveDashboardForm` |
| `DeleteDashboardButton`                 | `isManagedRepository()` returns `false` → uses standard delete modal        |
| `GeneralSettingsEditView` folder picker | `isManagedRepository()` returns `false` → standard folder change            |
| `MoveProvisionedDashboardDrawer`        | Never called (condition is false)                                           |
| `JsonModelEditView`                     | `useIsProvisionedNG` returns `false` → standard save                        |

### Pros

- **Fixes everything at once** — save, delete, move, folder picker, JSON editor all work without individual fixes
- Cleanest UX: orphaned dashboard behaves like a normal dashboard + warning badge
- No changes needed to provisioning drawer components
- Badge in navbar provides clear visual indicator

### Cons

- Modifies `DashboardScene` state model (core class)
- Detection hook runs on every dashboard render (but skips quickly for non-managed dashboards)
- Doesn't address folders (requires separate hook/component for `BrowseDashboardsPage`)
- More files changed in core scene code

---

## Comparison Matrix

| Criteria                 | Solution 1 (Hook) | Solution 2 (Banner) | Solution 3 (Minimal) | Solution 4 (Scene) |
| ------------------------ | ----------------- | ------------------- | -------------------- | ------------------ |
| New files                | 2                 | 6+                  | 1                    | 3                  |
| Modified files           | 4                 | 4                   | 4                    | 4                  |
| Fixes save drawer        | Yes               | No (banner only)    | Yes                  | Yes (bypasses it)  |
| Fixes delete drawer      | Yes               | No (banner only)    | Yes                  | Yes (bypasses it)  |
| Fixes move/folder picker | No                | No                  | No                   | Yes                |
| Page-level warning       | No                | Yes                 | No                   | Yes (badge)        |
| Navbar badge update      | No                | Yes                 | No                   | Yes                |
| Folder support           | Hook supports it  | Yes                 | No                   | No (follow-up)     |
| Diff size                | Medium            | Large               | Small                | Medium             |
| Cascading fix            | No                | No                  | No                   | Yes                |

---

## Bulk Actions Consideration

All 4 solutions above handle the **single-resource** case (viewing one orphaned dashboard/folder). But a deleted repo may have left **dozens or hundreds** of orphaned resources. Disconnecting them one-by-one is impractical.

### Existing bulk infrastructure

- `BrowseDashboardsPage` has checkbox selection + bulk delete/move via `BrowseActions`
- Provisioning already has `BulkDeleteProvisionedResource` and `BulkMoveProvisionedResource` in `public/app/features/provisioning/components/BulkActions/`
- `useSelectionProvisioningStatus` detects mixed provisioned/non-provisioned selections
- Backend search **indexes** `SEARCH_FIELD_MANAGER_ID` and `SEARCH_FIELD_MANAGED_BY` in Bleve, but the frontend search query builder doesn't expose filtering by them

### Bulk approach options

**Option A: Extend browse-dashboards bulk actions**

- When user selects orphaned items in the browse view, show a "Disconnect from repository" bulk action alongside existing delete/move
- Reuses existing `DashboardTreeSelection` infrastructure
- Requires: new `BulkDisconnectOrphanedResource` component following the `BulkDeleteProvisionedResource` pattern
- Gap: hard to _find_ orphaned resources — they're scattered across folders

**Option B: Orphan management admin page**

- Dedicated page (e.g., `/admin/provisioning/orphans` or a tab on the provisioning settings page)
- Lists all resources where `managerId` points to a non-existent repo
- Select-all + bulk release action
- Requires: search/list API that can filter by `managerId` annotation (frontend search doesn't expose this yet, but backend already indexes it)

**Option C: Add to any single-resource solution**

- Any of Solutions 1-4 can be combined with a bulk action
- The `useReleaseOrphanedResource` / `useDisconnectOrphanedResource` hook from the single-resource solution can be called in a loop for bulk release
- For frontend-only: iterate over selected items and PATCH each one sequentially

### Recommendation for bulk

- **Phase 1**: Implement single-resource disconnect (one of Solutions 1-4)
- **Phase 2**: Add bulk disconnect as a browse-dashboards bulk action (Option A) — simplest, reuses existing infrastructure
- **Phase 3** (optional): Add orphan management page (Option B) — best UX for admins managing many orphans, but requires more work

---

## Shared Implementation Details (All Solutions)

### Annotations to strip

```typescript
import {
  AnnoKeyManagerKind,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerAllowsEdits,
  AnnoKeySourcePath,
  AnnoKeySourceChecksum,
  AnnoKeySourceTimestamp,
} from 'app/features/apiserver/types';
```

### Merge-patch approach (preferred over JSON Patch)

```typescript
await getBackendSrv().patch(
  `/apis/dashboard.grafana.app/v2beta1/namespaces/${getAPINamespace()}/dashboards/${uid}`,
  { metadata: { annotations: { [AnnoKeyManagerKind]: null, [AnnoKeyManagerIdentity]: null, ... } } },
  { headers: { 'Content-Type': 'application/merge-patch+json' } }
);
```

### Admin check

```typescript
import { contextSrv } from 'app/core/services/context_srv';
const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
```

### i18n

All user-facing strings use `t()` / `<Trans>` from `@grafana/i18n`. Run `make i18n-extract` after changes.

---

## Verification

1. **Setup**: Create a repository, sync dashboards/folders, then improperly delete the repo (e.g., remove from DB/etcd directly or simulate by manually deleting the repo resource)
2. **View orphaned dashboard**: Should see warning (banner/badge depending on solution)
3. **Try save/delete**: Should see orphan-specific UI instead of generic error
4. **Admin disconnect**: Click disconnect, confirm, verify annotations are stripped
5. **Post-disconnect**: Dashboard is fully editable, save/delete work normally
6. **Non-admin user**: Should see warning but no disconnect action
7. **Run tests**: `yarn jest --no-watch public/app/features/provisioning/` and `yarn jest --no-watch public/app/features/dashboard-scene/`

---

## Your Approach

Hook-level fix (new Orphaned status) for save/delete drawers + OrphanedResourceBanner on dashboard + update navbar badge. Medium diff, covers all surfaces.
