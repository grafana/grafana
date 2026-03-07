# Plan: Refactor `ResponseTransformers.ts` to use Scene-based pipeline

## Background

`ResponseTransformers.ts` provides direct JSON-to-JSON conversion between v1 and v2 dashboard formats via ~1400 lines of manual mapping code. The codebase already has an alternative "Scene-based" pipeline that routes conversions through `DashboardScene`:

- **v1 → v2**: `transformSaveModelToScene` (v1 → Scene) → `transformSceneToSaveModelSchemaV2` (Scene → v2)
- **v2 → v1**: `transformSaveModelSchemaV2ToScene` (v2 → Scene) → `transformSceneToSaveModel` (Scene → v1)

The Scene-based pipeline is already validated to produce equivalent output via `ResponseTransformersToBackend.test.ts` (which confirms frontend/backend parity by routing both paths through Scene).

**Goal**: Keep `ResponseTransformers.ts` as a thin utility that preserves the same public API (`ensureV2Response`, `ensureV1Response`, etc.) but replaces the internal mapping implementation with calls to the Scene-based pipeline. This avoids scattering the `toScene → fromScene` boilerplate across every call site while eliminating the duplicated conversion logic.

---

## What `ResponseTransformers.ts` exports

| Export                              | Purpose                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ensureV2Response`                  | Wraps a v1 `DashboardDTO` (or v0 K8s resource) into `DashboardWithAccessInfo<V2Spec>`, converting spec + metadata + access |
| `ensureV1Response`                  | Converts `DashboardWithAccessInfo<V2Spec>` back to `DashboardDTO`                                                          |
| `ResponseTransformers`              | Object containing `{ ensureV2Response, ensureV1Response }`                                                                 |
| `transformDashboardV2SpecToV1`      | Core v2 spec → v1 `DashboardDataDTO` conversion                                                                            |
| `buildPanelKind`                    | Converts a single v1 `Panel` to v2 `PanelKind`                                                                             |
| `getDefaultDatasource`              | Gets default `DataSourceRef` with `apiVersion` (wraps `getDefaultDataSourceRef`)                                           |
| `getPanelQueries`                   | Converts `DataQuery[]` targets to `PanelQueryKind[]`                                                                       |
| `transformMappingsToV1`             | Converts v2 field config mappings/thresholds/colors to v1 enums                                                            |
| `transformAnnotationMappingsV1ToV2` | Converts v1 annotation mappings to v2 format                                                                               |

---

## The new `ResponseTransformers.ts` — thin utility over Scene pipeline

Instead of removing `ResponseTransformers.ts` entirely and scattering `toScene → fromScene` boilerplate across every call site, the file should be **rewritten** as a thin orchestration layer. It keeps the same public API that callers already depend on, but internally delegates all spec conversion to the Scene pipeline.

### What stays

The metadata/access mapping logic (mapping `DashboardDTO.meta` ↔ K8s annotations/labels/access) is **not** part of the Scene pipeline — it is a concern of the API response layer. This logic stays in `ResponseTransformers.ts`.

### What gets replaced

All ~1200 lines of manual spec conversion code (panels, variables, annotations, links, field configs, etc.) are removed. Instead, spec conversion delegates to:

- `transformSaveModelToScene` + `transformSceneToSaveModelSchemaV2` for v1 → v2
- `transformSaveModelSchemaV2ToScene` + `transformSceneToSaveModel` for v2 → v1

### Target shape

```ts
// ResponseTransformers.ts (rewritten — ~100-150 lines)

import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { transformSceneToSaveModelSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { transformSaveModelSchemaV2ToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModel } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModel';

/**
 * Convert a v1 DashboardDataDTO spec to a v2 DashboardV2Spec.
 * Delegates to the Scene pipeline: v1 → Scene → v2.
 */
export function v1SpecToV2Spec(v1Spec: DashboardDataDTO): DashboardV2Spec {
  const dto: DashboardDTO = { dashboard: v1Spec, meta: {} };
  const scene = transformSaveModelToScene(dto);
  return transformSceneToSaveModelSchemaV2(scene);
}

/**
 * Convert a v2 DashboardV2Spec to a v1 DashboardDataDTO spec.
 * Delegates to the Scene pipeline: v2 → Scene → v1.
 */
export function v2SpecToV1Spec(v2Spec: DashboardV2Spec, metadata: ObjectMeta): DashboardDataDTO {
  const wrapped: DashboardWithAccessInfo<DashboardV2Spec> = {
    apiVersion: 'v2beta1',
    kind: 'DashboardWithAccessInfo',
    metadata,
    spec: v2Spec,
    access: {},
  };
  const scene = transformSaveModelSchemaV2ToScene(wrapped);
  return transformSceneToSaveModel(scene);
}

/**
 * Ensure a dashboard response is in v2 format.
 * Metadata/access mapping is handled here (API-layer concern).
 * Spec conversion delegates to v1SpecToV2Spec when needed.
 */
export function ensureV2Response(
  dto: DashboardDTO | DashboardWithAccessInfo<DashboardDataDTO> | DashboardWithAccessInfo<DashboardV2Spec>
): DashboardWithAccessInfo<DashboardV2Spec> {
  if (isDashboardV2Resource(dto)) {
    return dto;
  }

  // --- metadata/access mapping (kept as-is, this is API-layer logic) ---
  const { accessMeta, annotationsMeta, labelsMeta, creationTimestamp, dashboard } = extractMetadataAndAccess(dto);

  // --- spec conversion via Scene pipeline ---
  const spec = v1SpecToV2Spec(dashboard);

  return {
    apiVersion: 'v2beta1',
    kind: 'DashboardWithAccessInfo',
    metadata: {
      creationTimestamp,
      name: dashboard.uid,
      resourceVersion: '...',
      annotations: annotationsMeta,
      labels: labelsMeta,
    },
    spec,
    access: accessMeta,
  };
}

/**
 * Ensure a dashboard response is in v1 format.
 * Metadata/access mapping is handled here.
 * Spec conversion delegates to v2SpecToV1Spec when needed.
 */
export function ensureV1Response(
  dashboard: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec> | DashboardWithAccessInfo<DashboardDataDTO>
): DashboardDTO {
  // ... metadata/access mapping kept as-is ...
  // ... spec conversion via v2SpecToV1Spec ...
}

export const ResponseTransformers = {
  ensureV2Response,
  ensureV1Response,
};
```

### Additional convenience functions

To avoid the raw `toScene → fromScene` boilerplate at call sites that only need spec conversion, expose two focused helpers:

| Function         | Signature                                                         | Delegates to                                                      |
| ---------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `v1SpecToV2Spec` | `(v1: DashboardDataDTO) => DashboardV2Spec`                       | `transformSaveModelToScene` → `transformSceneToSaveModelSchemaV2` |
| `v2SpecToV1Spec` | `(v2: DashboardV2Spec, metadata: ObjectMeta) => DashboardDataDTO` | `transformSaveModelSchemaV2ToScene` → `transformSceneToSaveModel` |

These are the building blocks used internally by `ensureV2Response` / `ensureV1Response`, but they are also exported for call sites that work with raw specs (e.g., `getDashboardChanges.ts`).

---

## Import sites — what changes for each caller

### 1. `public/app/features/dashboard/services/DashboardLoaderSrv.ts`

**Imports**: `ResponseTransformers` (uses `.ensureV2Response`)

**Usage**: `DashboardLoaderSrvV2` normalizes scripted, public, and snapshot dashboard responses to `DashboardWithAccessInfo<V2Spec>`.

- Line 194: `ResponseTransformers.ensureV2Response(r)` — scripted dashboards
- Line 197: `ResponseTransformers.ensureV2Response(result)` — public dashboards
- Line 238: `ResponseTransformers.ensureV2Response(r)` — snapshots

**Change needed**: None — the call sites keep using `ResponseTransformers.ensureV2Response`. The internal implementation changes but the API stays the same.

**Complexity**: None for this caller.

---

### 2. `public/app/features/dashboard-scene/pages/DashboardScenePageStateManager.ts`

**Imports**: `ensureV2Response`, `transformDashboardV2SpecToV1`

**Usage A** — `transformDashboardV2SpecToV1` (line 176):

```ts
if (isDashboardV2Spec(rsp.dashboard)) {
  rsp.dashboard = transformDashboardV2SpecToV1(rsp.dashboard, { name: '', ... });
}
```

Converts home dashboard v2 spec to v1 because there's no v2 API for home dashboards. The result is then passed to `transformSaveModelToScene`.

**Replacement**: Use the new `v2SpecToV1Spec` helper, or go directly v2 → Scene using `transformSaveModelSchemaV2ToScene` (since the goal is a `DashboardScene` anyway, skipping the v1 intermediate is better):

```ts
if (isDashboardV2Spec(rsp.dashboard)) {
  const wrapped = wrapV2SpecAsResource(rsp.dashboard, { name: '', ... });
  return transformSaveModelSchemaV2ToScene(wrapped);
}
```

**Complexity**: Low. Local change in `fetchHomeDashboard` / `loadHomeDashboard`.

---

**Usage B** — `ensureV2Response` (line 889):

```ts
const v2Response = ensureV2Response(rsp);
const scene = transformSaveModelSchemaV2ToScene(v2Response);
```

Used in `DashboardScenePageStateManagerV2.loadSnapshotScene`. The `rsp` comes from `DashboardLoaderSrvV2.loadSnapshot` which already calls `ensureV2Response` internally, so this is a safety no-op.

**Change needed**: None — `ensureV2Response` still exists with the same signature. Internally it now routes through Scene.

**Complexity**: None for this caller.

---

### 3. `public/app/features/dashboard-scene/saving/getDashboardChanges.ts`

**Imports**: `ResponseTransformers` (uses `.ensureV2Response`)

**Usage** (line 94):

```ts
function convertToV2SpecIfNeeded(initial: DashboardV2Spec | Dashboard): DashboardV2Spec {
  if (isDashboardV2Spec(initial)) {
    return initial;
  }
  const dto: DashboardDTO = { dashboard: initial as DashboardDataDTO, meta: {} };
  return ResponseTransformers.ensureV2Response(dto).spec;
}
```

**Change needed**: Can stay as-is (still works), or simplify to use the new `v1SpecToV2Spec` helper:

```ts
function convertToV2SpecIfNeeded(initial: DashboardV2Spec | Dashboard): DashboardV2Spec {
  if (isDashboardV2Spec(initial)) {
    return initial;
  }
  return v1SpecToV2Spec(initial as DashboardDataDTO);
}
```

**Complexity**: Very low. Optional cleanup.

---

### 4. `public/app/features/dashboard-scene/scene/export/exporters.ts`

**Imports**: `buildPanelKind`

**Usage** (line 368):

```ts
const fullLibraryPanel = await getLibraryPanel(libraryPanel.uid, true);
const panelModel: Panel = fullLibraryPanel.model;
const inlinePanel = buildPanelKind(panelModel);
```

Converts a library panel's raw `Panel` model to `PanelKind` during dashboard export.

**Change needed**: `buildPanelKind` is a single-panel converter that does not go through the full dashboard Scene pipeline. It should be **extracted** to a shared utility (e.g., `panelModelToV2Utils.ts`) rather than kept in `ResponseTransformers.ts`. This is the one function that remains as direct mapping code because wrapping a single `Panel` in a full `DashboardScene` just to extract one `PanelKind` would be disproportionate.

**Complexity**: Low-medium. Extract `buildPanelKind` and its transitive dependencies (`getPanelQueries`, `getPanelTransformations`, `extractAngularOptions`, `knownPanelProperties`).

---

### 5. `public/app/features/dashboard-scene/serialization/sceneVariablesSetToVariables.ts`

**Imports**: `getDefaultDatasource`

**Usage** (lines 444, 531, 559):
Used as a fallback when `variable.state.pluginId` or `variable.state.datasource?.type` is undefined.

**Replacement**: `getDefaultDatasource` is a thin wrapper around `getDefaultDataSourceRef` (already in `transformSceneToSaveModelSchemaV2.ts`) that adds `apiVersion`. Since the callers here only use `.type` (not `.apiVersion`), they can use `getDefaultDataSourceRef().type` directly.

`getDefaultDataSourceRef` is already exported from `transformSceneToSaveModelSchemaV2.ts` and is imported in `ResponseTransformers.ts` itself (line 66).

**Complexity**: Very low. Simple import swap.

---

## File changes summary

| File                                                                      | Action                                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `public/app/features/dashboard/api/ResponseTransformers.ts`               | **Rewrite** — keep as thin utility, replace ~1200 lines of mapping code with Scene pipeline delegation             |
| `public/app/features/dashboard/api/ResponseTransformers.test.ts`          | **Rewrite** — update tests to verify the new thin utility (same inputs/outputs, different implementation)          |
| `public/app/features/dashboard/api/ResponseTransformersToBackend.test.ts` | **Rename** to `frontendBackendConversionParity.test.ts` — it already uses Scene pipeline, not ResponseTransformers |

### Note on `ResponseTransformersToBackend.test.ts`

This test does NOT import from `ResponseTransformers.ts` — it uses `transformSaveModelToScene` and `transformSceneToSaveModelSchemaV2` directly. Its name is misleading. It should be renamed to reflect its actual purpose (validating frontend/backend conversion parity via the Scene pipeline).

---

## Functions: what happens to each

| Function                            | Action                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ensureV2Response`                  | **Keep** — rewrite internals to use `v1SpecToV2Spec`; metadata/access mapping stays                                          |
| `ensureV1Response`                  | **Keep** — rewrite internals to use `v2SpecToV1Spec`; metadata/access mapping stays                                          |
| `ResponseTransformers`              | **Keep** — same `{ ensureV2Response, ensureV1Response }` object                                                              |
| `v1SpecToV2Spec`                    | **New** — `transformSaveModelToScene` → `transformSceneToSaveModelSchemaV2`                                                  |
| `v2SpecToV1Spec`                    | **New** — `transformSaveModelSchemaV2ToScene` → `transformSceneToSaveModel`                                                  |
| `transformDashboardV2SpecToV1`      | **Remove** — replaced by `v2SpecToV1Spec`                                                                                    |
| `buildPanelKind`                    | **Extract** to `panelModelToV2Utils.ts` — single-panel conversion, kept as direct mapping (Scene pipeline is overkill)       |
| `getPanelQueries`                   | **Extract** with `buildPanelKind` — transitive dependency                                                                    |
| `getDefaultDatasource`              | **Remove** — callers switch to `getDefaultDataSourceRef` from `transformSceneToSaveModelSchemaV2.ts`                         |
| `transformMappingsToV1`             | **Remove** — duplicate already exists in `transformToV1TypesUtils.ts`                                                        |
| `transformAnnotationMappingsV1ToV2` | **Remove** — counterpart already exists in `annotations.ts`                                                                  |
| All other internal functions        | **Remove** — ~1000 lines of `getElementsFromPanels`, `getVariables`, `getAnnotations`, `getVariablesV1`, `getPanelsV1`, etc. |

---

## Execution plan (ordered steps)

### Phase 1: Extract `buildPanelKind` and fix minor imports

1. **Extract `buildPanelKind`** and its dependencies (`getPanelQueries`, `getPanelTransformations`, `extractAngularOptions`, `knownPanelProperties`) to a new utility file (e.g., `public/app/features/dashboard-scene/serialization/panelModelToV2Utils.ts`).
2. **Update `exporters.ts`** to import `buildPanelKind` from the new location.
3. **Update `sceneVariablesSetToVariables.ts`** to use `getDefaultDataSourceRef` from `transformSceneToSaveModelSchemaV2.ts` instead of `getDefaultDatasource` from `ResponseTransformers.ts`.

### Phase 2: Rewrite `ResponseTransformers.ts`

4. **Add `v1SpecToV2Spec` and `v2SpecToV1Spec`** — new convenience functions that delegate to the Scene pipeline.
5. **Rewrite `ensureV2Response`** — keep the metadata/access mapping logic, replace the spec conversion with a call to `v1SpecToV2Spec`.
6. **Rewrite `ensureV1Response`** — keep the metadata/access mapping logic, replace the spec conversion with a call to `v2SpecToV1Spec`.
7. **Remove all internal mapping functions** — `getElementsFromPanels`, `convertToRowsLayout`, `getVariables`, `getAnnotations`, `getVariablesV1`, `getPanelsV1`, `transformV2PanelToV1Panel`, `transformDashboardV2SpecToV1`, `transformMappingsToV1`, `colorIdToEnumv1`, `transformSpecialValueMatchToV1`, `transformToV1VariableTypes`, etc.

### Phase 3: Update callers that used removed exports

8. **Update `DashboardScenePageStateManager.fetchHomeDashboard`** — replace `transformDashboardV2SpecToV1` with either `v2SpecToV1Spec` or go directly v2 → Scene via `transformSaveModelSchemaV2ToScene`.
9. **Optionally update `getDashboardChanges.ts`** — simplify from `ResponseTransformers.ensureV2Response(dto).spec` to `v1SpecToV2Spec(initial)`.

### Phase 4: Update tests and rename

10. **Rewrite `ResponseTransformers.test.ts`** — test the rewritten thin utility (same inputs/outputs, implementation is now Scene-based). Tests for removed internal functions (e.g., `transformMappingsToV1`) can be deleted since those are tested via the Scene serialization tests.
11. **Rename `ResponseTransformersToBackend.test.ts`** to `frontendBackendConversionParity.test.ts`.
12. **Run tests**: `yarn test public/app/features/dashboard/api/ public/app/features/dashboard-scene/`.
13. **Run typecheck**: `yarn typecheck`.

---

## Risks and considerations

1. **Performance**: The Scene pipeline creates full `DashboardScene` objects for spec conversions. This is heavier than direct JSON-to-JSON mapping. For `ensureV2Response`/`ensureV1Response` in the loader path, the Scene object is created and immediately discarded (the caller then creates another Scene from the v2 result). For `getDashboardChanges`, the overhead only occurs on save. Measure if this is acceptable in practice; if not, the loader path could be restructured to avoid the double Scene creation (return `DashboardDTO` and let the caller use the v1 → Scene path directly).

2. **Metadata/access mapping**: Since metadata/access mapping stays in `ResponseTransformers.ts`, this concern is addressed. No risk of losing this logic.

3. **Snapshot handling**: Snapshots have special handling (snapshot data, `AnnoKeyDashboardIsSnapshot` annotation). Verify that the Scene pipeline handles snapshots correctly when invoked through the new `v1SpecToV2Spec`.

4. **Public dashboards**: Public dashboard responses may already have v2 specs returned through the legacy API (the `isDashboardV2Spec(dto.dashboard)` check at line 161). This edge case is handled in `ensureV2Response` and should be preserved.

5. **Scripted dashboards**: These are a legacy feature but still supported. Verify that `v1SpecToV2Spec` (via `transformSaveModelToScene`) works for dynamically generated dashboard JSON.

6. **`transformMappingsToV1` duplication**: Both `ResponseTransformers.ts` and `transformToV1TypesUtils.ts` have implementations. Verify they are equivalent before removing the ResponseTransformers version.

7. **`buildPanelKind` extraction**: This function is kept as direct mapping code (not Scene-based) because wrapping a single `Panel` in a full `DashboardScene` to extract one `PanelKind` would be disproportionate. Ensure all transitive dependencies are correctly extracted.

---

## Test strategy

- Run existing Scene serialization tests to validate parity
- Run `ResponseTransformersToBackend.test.ts` (renamed) to confirm frontend/backend parity is maintained
- Run dashboard API tests: `yarn test public/app/features/dashboard/api/`
- Run dashboard-scene tests: `yarn test public/app/features/dashboard-scene/`
- Run typecheck: `yarn typecheck`
