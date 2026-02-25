# Plan: Optimize dashboardControls tests + extract dashboard DS refs (revised)

## Overview

1. **Extract** `getDsRefsFromV1Dashboard` and `getDsRefsFromV2Dashboard` (and their private helpers) from `dashboardControls.ts` into a new file **`dashboardDsRefs.ts`**.
2. **Keep** `dashboardControls.test.ts` and **trim** it so it only contains tests for `loadDefaultControlsFromDatasources` (including tracking). Remove the two describes for `getDsRefsFromV1Dashboard` and `getDsRefsFromV2Dashboard`. Keep all existing fixtures and helper functions in this file (no extraction to a shared file).
3. **Add** **`dashboardDsRefs.test.ts`** with all tests for `getDsRefsFromV1Dashboard` and `getDsRefsFromV2Dashboard` (moved from `dashboardControls.test.ts`). In this file, introduce **`createMinimalV1DashboardDTO`** and **`createMinimalV2Dashboard`** (defined locally in the test file) and refactor the tests to use them so the file is smaller and more readable. Duplicate any helper/fixture code in this file only if a test needs it.

---

## Step 1: Create `dashboardDsRefs.ts`

**New file:** `public/app/features/dashboard-scene/utils/dashboardDsRefs.ts`

**Move from `dashboardControls.ts`:**

- `getDatasourceRefFromPanel` (private helper)
- `getDsRefsFromV1Panels` (private helper)
- `getDsRefsFromV1Variables` (private helper)
- `deduplicateDatasourceRefsByType` (private helper)
- `getDsRefsFromV1Dashboard` (export)
- `getDsRefsFromV2Dashboard` (export)

**Imports needed in `dashboardDsRefs.ts`:**

- `DataSourceRef` from `@grafana/schema`
- `DashboardDTO` from `app/types/dashboard`
- `DashboardWithAccessInfo` from `app/features/dashboard/api/types`
- `Spec as DashboardV2Spec` from `@grafana/schema/apis/dashboard.grafana.app/v2`
- `getRuntimePanelDataSource` from `../serialization/layoutSerializers/utils`

**Update `dashboardControls.ts`:**

- Remove all of the above functions and any imports only used by them.
- Keep: `loadDefaultControlsFromDatasources`, `loadDatasources`, `loadDefaultControlsByRefs`, `invokeAndTrack`, `sortByProp`, `sortDefaultVarsFirst`, `sortDefaultLinksFirst`, and their imports.

**Update callers:**

- **`DashboardScenePageStateManager.ts`**: today it imports `getDsRefsFromV1Dashboard` and `getDsRefsFromV2Dashboard` from `./utils/dashboardControls`. Change to import them from `./utils/dashboardDsRefs` (same directory under `pages/` is `../utils/dashboardDsRefs` or equivalent relative path).

---

## Step 2: Trim `dashboardControls.test.ts`

**Keep** `dashboardControls.test.ts`; do not create a new file.

- **Remove** from this file the two entire describes: `getDsRefsFromV1Dashboard` and `getDsRefsFromV2Dashboard` (including all their tests). Those tests move to `dashboardDsRefs.test.ts` (Step 3).
- **Keep** in this file: the `jest.mock` setup, `beforeEach`, all existing helper functions and fixtures (e.g. `createMockDataSourceSrv`, `createMockDatasource`, `mockVariable1`, `mockVariable2`, `mockLink1`, `mockLink2`), and the single top-level `describe('loadDefaultControlsFromDatasources', () => { ... })` with:
  - All current tests: empty refs, collect variables, collect links, both, null/undefined.
  - Nested `describe('tracking', () => { ... })` with the 3 tracking tests.
- **Update** imports: remove `getDsRefsFromV1Dashboard` and `getDsRefsFromV2Dashboard` from the import from `./dashboardControls`; keep only `loadDefaultControlsFromDatasources`.

---

## Step 3: Add `dashboardDsRefs.test.ts`

**New file:** `public/app/features/dashboard-scene/utils/dashboardDsRefs.test.ts`

- **Move** here all tests from the removed `getDsRefsFromV1Dashboard` and `getDsRefsFromV2Dashboard` describes (from `dashboardControls.test.ts`).
- **Define in this file** (no shared helpers file):
  - **`createMinimalV1DashboardDTO(overrides?)`** – returns a minimal valid `DashboardDTO`; caller overrides only what the test needs (e.g. `dashboard.panels`, `dashboard.templating`). Use it in every V1 test so each test only sets panels/templating and assertions.
  - **`createMinimalV2Dashboard(overrides?)`** – returns a minimal valid `DashboardWithAccessInfo<DashboardV2Spec>`; caller overrides only what the test needs (e.g. `spec.elements`, `spec.variables`). Use it in every V2 test so each test only sets elements/variables and assertions.
- **Duplicate** any other helper or fixture in this file only if a test needs it (e.g. mock for `getRuntimePanelDataSource` for V2 tests that use it).
- Imports: `getDsRefsFromV1Dashboard`, `getDsRefsFromV2Dashboard` from `./dashboardDsRefs`; plus whatever types/fixtures the minimal builders need (`DashboardDTO`, `DashboardWithAccessInfo`, `DashboardV2Spec`, etc.).
- Structure:
  - `describe('getDsRefsFromV1Dashboard', () => { ... })` – all 5 existing tests, refactored to use `createMinimalV1DashboardDTO`.
  - `describe('getDsRefsFromV2Dashboard', () => { ... })` – all 7 existing tests, refactored to use `createMinimalV2Dashboard`.

---

## Step 4: Verify

- Run:
  - `yarn test public/app/features/dashboard-scene/utils/dashboardControls.test.ts`
  - `yarn test public/app/features/dashboard-scene/utils/dashboardDsRefs.test.ts`
- Run full utils suite: `yarn test public/app/features/dashboard-scene/utils`.
- Confirm `DashboardScenePageStateManager` still passes (it now imports from `dashboardDsRefs`).

---

## Summary

| Step | Action                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Create `dashboardDsRefs.ts` with getDsRefsFromV1Dashboard, getDsRefsFromV2Dashboard and their private helpers; update `dashboardControls.ts` and `DashboardScenePageStateManager.ts` imports.                            |
| 2    | Trim `dashboardControls.test.ts`: remove the getDsRefsFromV1Dashboard and getDsRefsFromV2Dashboard describes; keep only loadDefaultControlsFromDatasources and all existing helpers/fixtures in this file.               |
| 3    | Create `dashboardDsRefs.test.ts` with the moved V1/V2 tests; add `createMinimalV1DashboardDTO` and `createMinimalV2Dashboard` in this file and refactor tests to use them; duplicate only any other helpers needed here. |
| 4    | Run both test files and full utils suite; confirm state manager still passes.                                                                                                                                            |

Result: DS ref extraction lives in `dashboardDsRefs.ts`; default controls loading stays in `dashboardControls.ts`; no shared test-helpers file; `dashboardControls.test.ts` keeps its helpers and only covers loadDefaultControls; `dashboardDsRefs.test.ts` holds the DS ref tests and uses local `createMinimalV1DashboardDTO` / `createMinimalV2Dashboard` to keep the file smaller and more readable.
