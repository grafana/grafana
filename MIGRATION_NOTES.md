# Mutation API Zod migration — behavior changes

This document tracks the per-schema behavior changes introduced when migrating
[`public/app/features/dashboard-scene/mutation-api/commands/schemas.ts`](public/app/features/dashboard-scene/mutation-api/commands/schemas.ts)
from hand-written Zod definitions to re-exports of the CUE-derived bundle at
[`apps/dashboard/zod-schemas/v2beta1/index.ts`](apps/dashboard/zod-schemas/v2beta1/index.ts).

> This file is intended for the PR description and will be deleted before merge.

## Summary

- 35 of the 64 schemas in `schemas.ts` now source their shape from the bundle.
- 0 tests fail; behavior changes are the deliberate ones listed below.
- File size went from 1031 lines to ~928 lines (a modest reduction; most savings
  are absorbed by `MIGRATION T...` inline comments explaining each derivation).
- The real win is **drift detection**: when CUE renames a kind or adds/removes
  a field, the migrated schemas fail at typecheck instead of silently diverging.

## Migration tiers

- **T1** — Pure re-export. Generated shape matches manual.
- **T2** — Re-export + small `.extend()`. Generated mostly matches; one or two
  fields need overrides to preserve behavior.
- **T3** — Re-export + heavy `.extend()`. Generated and manual diverge a lot
  but composability still wins.
- **T4** — Keep manual. Schema doesn't exist in CUE, OR is a payload contract.

---

## Behavior changes (require LLM-tool / consumer awareness)

> Each entry below documents a **deliberate** loss of mutation-API-specific
> behavior in exchange for single-source-of-truth with the CUE schema.
> Follow-ups to address each are listed at the bottom.

### Discriminated unions become plain unions

- `conditionalRenderingGroupKindSchema.spec.items` — was `z.discriminatedUnion`,
  now `z.union` (re-exported from bundle). Error messages on malformed input
  differ: instead of "Invalid discriminator value", consumers see all branches
  attempted and the closest match's errors. Valid inputs still parse identically.

### `variableKindSchema` kept as `z.discriminatedUnion`

The mutation-API `variableKindSchema` remains a `z.discriminatedUnion` over the
locally-defined variable kind schemas. The bundle's `variableKindSchema` is a
plain `z.union` over bundle's variable kinds (which have a different spec shape
than the mutation API exposes), so we cannot drop in the bundle's union here.

### `z.int()` instead of `z.number()`

- `repeatOptionsSchema.maxPerRow` — bundle uses `z.int()`, rejecting
  floating-point inputs (semantically correct for a panel count).
- `queryOptionsSpecSchema.maxDataPoints` and `queryOptionsSpecSchema.queryCachingTTL`
  — same change (semantically correct).
- `gridLayoutItemKindSchema.spec.{x,y,width,height}` — KEPT as `z.number()` via
  `.extend()` override; mutation API has historically been permissive here.

### Field-level `.describe()` text is lost

Every migrated schema loses the LLM-tuned describe annotations on individual
fields. The schemas still validate the same shapes, but the JSON Schema fed to
LLM tools (via `z.toJSONSchema()`) is less self-documenting. Affected fields
are too numerous to list individually; spot-check the diff in
[schemas.ts](public/app/features/dashboard-scene/mutation-api/commands/schemas.ts)
to see which describes were removed.

### Top-level `.describe()` text is lost where the bundle has CUE-derived describes

The bundle inherits CUE's documentation comments, which are dev-tone (intended
for engineers reading the schema), not LLM-tone. For example:

- `dataQueryKindSchema.datasource` carries the CUE comment "New type for
  datasource reference\nNot creating a new type until we figure out…" instead
  of the mutation-API "Datasource reference" describe.

### Validation removed

- `vizConfigKindSchema.group` — was `z.string().min(1)`, now `z.string()` (no
  emptiness check). LLM tools may now submit empty plugin IDs without
  client-side rejection.

### Extra CUE fields newly accepted

- `dataQueryKindSchema.labels` — bundle has `labels: z.optional(z.object({}).catchall(z.string()))`.
  Mutation API previously omitted this; now LLM input may include `labels` even
  though the backend doesn't read it from this code path.
- `autoGridLayoutItemKindSchema.spec.conditionalRendering` — bundle exposes
  this as optional; mutation API previously didn't accept it here. Net positive
  (it's a real feature).

---

## Schemas kept manual (T4)

Reason listed for each.

**No CUE equivalent (mutation-API-only):**

- `adHocFilterSchema` — internal helper for ad-hoc filter shape used by `adhocVariableKindSchema`.
- `gridPositionSchema` — partial-update variant of grid coords.
- `layoutPathSchema` — path string with regex (`/`, `/rows/0`, etc.).
- `layoutTypeSchema` — enum mapping the layout target.
- `autoGridOptionsSchema` — partial of `autoGridLayoutSpecSchema` minus the
  `items` field; mutation-API treats this as standalone options.
- `commonVariableSpecFields` — local composition helper (object spread used by
  variable kinds).
- `defaultVariableOption` — local default value `{ text: '', value: '' }`.
- `layoutItemInputSchema` — input variant for `addPanel`/`movePanel`.
- `partialPanelKindSchema`, `partialRowSpecSchema`, `partialTabSpecSchema` —
  partial update variants; deriving from canonical schemas via `.partial()` is
  unsafe because canonical schemas have `.default()`s that would override the
  "leave unchanged if omitted" semantics.
- `emptyPayloadSchema` — empty strict object.
- All 24 `*PayloadSchema` exports — mutation-API command contracts.
- `payloads` record — keyed map of command schemas.

**Bundle exists but not viable to derive from:**

- `metricFindValueSchema` — bundle has the shape but no describes; manual is
  retained to preserve the LLM describes. Re-exportable after the L2 follow-up.
- All 9 variable kind schemas (`queryVariableKindSchema`, `customVariableKindSchema`,
  `datasourceVariableKindSchema`, `intervalVariableKindSchema`, `constantVariableKindSchema`,
  `textVariableKindSchema`, `groupByVariableKindSchema`, `adhocVariableKindSchema`,
  `switchVariableKindSchema`) — bundle's spec shapes diverge heavily (extra
  `regexApplyTo`/`definition`/`staticOptions`/`origin` fields, weird `current`
  union with broken `.default({})`). A T3 extend would override almost every
  field — net zero savings over keeping manual. Bundle's `variableHideSchema`,
  `variableRefreshSchema`, `variableSortSchema`, `variableOptionSchema` ARE
  re-exported as building blocks.
- `variableKindSchema` — manual `z.discriminatedUnion` over the manual variable
  kinds (since the kinds themselves are manual).
- `transformationKindSchema` — different protocol than CUE (see per-schema log).
- `fieldConfigSchema` — bundle's name refers to per-field config; the equivalent
  "defaults + overrides" container (`fieldConfigSourceSchema`) is fully typed
  and the mutation API needs a permissive shape.

---

## Per-schema migration log

| Manual schema                                 | Tier | Notes                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataLinkSchema`                              | T1   | Already migrated in earlier commit.                                                                                                                                                                                                                                                                                                                                    |
| `elementReferenceSchema`                      | T1   | Already migrated in earlier commit.                                                                                                                                                                                                                                                                                                                                    |
| `dataQueryKindSchema`                         | T2   | Override `spec` to keep `z.record(z.string(), z.unknown())`; bundle accepts extra `labels`.                                                                                                                                                                                                                                                                            |
| `variableOptionSchema`                        | T1   | Re-exported. Bundle has equivalent shape, lost field describes.                                                                                                                                                                                                                                                                                                        |
| `variableHideSchema`                          | T1   | Re-exported. Bundle already has `.default('dontHide')`.                                                                                                                                                                                                                                                                                                                |
| `variableRefreshSchema`                       | T1   | Re-exported. Bundle already has `.default('never')`.                                                                                                                                                                                                                                                                                                                   |
| `variableSortSchema`                          | T2   | Bundle lacks default; `.default('disabled')` re-applied locally.                                                                                                                                                                                                                                                                                                       |
| `metricFindValueSchema`                       | T4   | Re-decide: bundle exists but no describes — keep manual for now to preserve LLM describes.                                                                                                                                                                                                                                                                             |
| `queryVariableKindSchema`                     | T4   | Bundle spec diverges heavily (extra `regexApplyTo`/`definition`/`staticOptions`/`origin` fields, weird `current` union with broken `.default({})`). Re-using bundle would require overriding nearly every field — net zero savings. Helpers (`variableHideSchema`, `variableRefreshSchema`, `variableSortSchema`, `variableOptionSchema`) ARE re-exported from bundle. |
| `customVariableKindSchema`                    | T4   | Same reasoning.                                                                                                                                                                                                                                                                                                                                                        |
| `datasourceVariableKindSchema`                | T4   | Same reasoning.                                                                                                                                                                                                                                                                                                                                                        |
| `intervalVariableKindSchema`                  | T4   | Same reasoning.                                                                                                                                                                                                                                                                                                                                                        |
| `constantVariableKindSchema`                  | T4   | Same reasoning.                                                                                                                                                                                                                                                                                                                                                        |
| `textVariableKindSchema`                      | T4   | Same reasoning.                                                                                                                                                                                                                                                                                                                                                        |
| `groupByVariableKindSchema`                   | T4   | Same reasoning.                                                                                                                                                                                                                                                                                                                                                        |
| `adhocVariableKindSchema`                     | T4   | Same reasoning.                                                                                                                                                                                                                                                                                                                                                        |
| `switchVariableKindSchema`                    | T4   | Same reasoning.                                                                                                                                                                                                                                                                                                                                                        |
| `variableKindSchema`                          | T4   | Manual `z.discriminatedUnion` over the manual kinds; can't re-export bundle's union because it composes bundle's variable kinds (not the local mutation-API-tuned ones).                                                                                                                                                                                               |
| `conditionalRenderingDataKindSchema`          | T1   | Re-exported.                                                                                                                                                                                                                                                                                                                                                           |
| `conditionalRenderingTimeRangeSizeKindSchema` | T1   | Re-exported.                                                                                                                                                                                                                                                                                                                                                           |
| `conditionalRenderingVariableKindSchema`      | T1   | Re-exported.                                                                                                                                                                                                                                                                                                                                                           |
| `conditionalRenderingGroupKindSchema`         | T1   | Re-exported (bundle's `z.union` accepted; lost discriminatedUnion).                                                                                                                                                                                                                                                                                                    |
| `repeatOptionsSchema`                         | T1   | Re-exported. Bundle uses `repeatModeSchema` (single-value enum) instead of `z.literal('variable')` (equivalent at runtime), and `maxPerRow` is `z.int()` instead of `z.number()` (rejects fractional inputs).                                                                                                                                                          |
| `rowRepeatOptionsSchema`                      | T1   | Re-exported (single-value enum vs literal — equivalent). Used by the manual `partialRowSpecSchema`.                                                                                                                                                                                                                                                                    |
| `tabRepeatOptionsSchema`                      | T1   | Re-exported. Used by the manual `partialTabSpecSchema`.                                                                                                                                                                                                                                                                                                                |
| `rowsLayoutRowSpecSchema`                     | T2   | `.omit({ layout, variables })` (CUE has these fields, mutation API doesn't expose them) and `.extend()` to add `.default(false)` on `collapse`/`hideHeader`/`fillScreen` for LLM ergonomics.                                                                                                                                                                           |
| `tabsLayoutTabSpecSchema`                     | T2   | `.omit({ layout, variables })`.                                                                                                                                                                                                                                                                                                                                        |
| `panelQueryKindSchema`                        | T2   | Override `spec` to point at locally-extended `dataQueryKindSchema`, drop bundle's `refId.default('A')`, and make `hidden` optional+default(false).                                                                                                                                                                                                                     |
| `transformationKindSchema`                    | T4   | Mutation API uses a different transformation protocol than CUE: `kind` is the constant 'Transformation' and the transformer ID lives on a separate `group` field, while CUE puts the transformer ID directly in `kind: z.string()`. These two protocols cannot be reconciled without a breaking API change.                                                            |
| `queryOptionsSpecSchema`                      | T1   | Re-exported. Bundle uses `z.int()` for `maxDataPoints`/`queryCachingTTL` instead of `z.number()` — fractional inputs now rejected (semantically correct).                                                                                                                                                                                                              |
| `fieldConfigSchema`                           | T4   | Bundle's `fieldConfigSchema` is per-field config (displayName, color, etc.); the equivalent "defaults + overrides" container in the bundle is `fieldConfigSourceSchema` and is fully typed. Mutation API needs a permissive container so LLM tools can submit arbitrary plugin-specific shapes.                                                                        |
| `vizConfigKindSchema`                         | T2   | Override `version` to optional+default(''), rewrite `spec` to the mutation-API-shaped permissive object. Lost: `.min(1)` validation on `group`.                                                                                                                                                                                                                        |
| `queryGroupKindSchema`                        | T2   | Override spec to point at locally-extended `panelQueryKindSchema`/`transformationKindSchema`, and make `transformations`/`queryOptions` optional+default.                                                                                                                                                                                                              |
| `panelKindSchema`                             | T2   | Override spec: `.omit({ id })` (auto-assigned), make `description`/`links`/`transparent` optional+default for LLM ergonomics, point `data`/`vizConfig` at locally-extended versions.                                                                                                                                                                                   |
| `gridLayoutItemKindSchema`                    | T2   | Override spec to swap `z.int()` → `z.number()` on x/y/width/height for backward compatibility with previous mutation-API permissiveness.                                                                                                                                                                                                                               |
| `autoGridLayoutItemKindSchema`                | T1   | Re-exported (bundle now exposes `conditionalRendering` field, accepted as net positive).                                                                                                                                                                                                                                                                               |

---

## Follow-up tickets (out of scope for this PR)

- **L2 upstream describes to CUE** — restore field-level LLM describes by adding
  CUE comments on the relevant fields in
  [`apps/dashboard/kinds/v2beta1/dashboard_spec.cue`](apps/dashboard/kinds/v2beta1/dashboard_spec.cue).
  After upstreaming, `metricFindValueSchema` and many fields-level
  `.describe()`s in T2/T3 schemas can be dropped from `schemas.ts`.
- **L3/L10 upstream defaults to CUE** — add `field?: type | *value` to
  CUE for fields the mutation API treats as optional-with-default
  (`hidden: bool` → `hidden?: bool | *false`, `transformations`, `queryOptions`,
  etc.). Coordinate with dashboard-squad as it changes persistence semantics.
- **L6 z.union → z.discriminatedUnion** — generator post-process to detect
  unions of `kind`-tagged objects and emit `z.discriminatedUnion` instead of
  `z.union`.
- **L8 strip K8s metadata fields** — generator config to omit known-noise CUE
  fields (`labels`, etc.) per app.
- **Restore validation on `vizConfigKindSchema.group`** — either upstream
  `.min(1)` to CUE (CUE has `string & =~ ".+"` style validators) or override
  via `.extend()` in `schemas.ts`.
