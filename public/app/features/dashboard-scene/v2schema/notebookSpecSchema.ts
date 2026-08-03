/**
 * Canonical Zod schema for the Notebook v2beta1 spec.
 *
 * Mirrors `apps/dashboard/kinds/v2beta1/notebook_spec.cue` the same way
 * {@link ./dashboardV2Schema} mirrors the dashboard v2 CUE, and follows the same conventions
 * (CUE `*value` defaults encoded as `.optional().default(...)`, Go nil slices tolerated via
 * `nullableArray`, non-strict objects for forward compatibility, `satisfies z.ZodType<...>` so
 * the schema and the generated interface cannot drift).
 *
 * A notebook reuses the dashboard's panel, library-panel and time-settings leaves verbatim, so
 * those are imported rather than restated: `PanelKind` is byte-identical across the two schemas
 * and that is exactly what makes a panel round-trip between a dashboard, Explore and a notebook.
 * What is notebook-only is `CellKind` (narrative content) and `NotebookLayout` (a flat ordered
 * list of cells).
 *
 * The generated notebook and dashboard leaf types are structurally identical but come from
 * different modules, so `satisfies` is checked against the notebook types and the shared
 * schemas are reused for the value.
 */

import * as z from 'zod';

import type {
  Spec as NotebookSpec,
  CellKind,
  CellContentKind,
  MarkdownCellContentKind,
  CodeCellContentKind,
  NotebookElement,
  NotebookLayoutKind,
  NotebookLayoutItemKind,
  PanelKind as NotebookPanelKind,
  QueryGroupKind as NotebookQueryGroupKind,
  TransformationKind as NotebookTransformationKind,
} from '@grafana/schema/apis/notebook/v2beta1';

import {
  dataLinkSchema,
  elementReferenceSchema,
  libraryPanelKindSchema,
  matcherConfigSchema,
  nullableArray,
  panelQueryKindSchema,
  queryOptionsSpecSchema,
  timeSettingsSpecSchema,
  vizConfigKindSchema,
} from './dashboardV2Schema';

// ---------------------------------------------------------------------------
// Narrative cells
// ---------------------------------------------------------------------------

const markdownCellContentKindSchema = z.object({
  kind: z.literal('Markdown'),
  spec: z.object({
    text: z.string(),
  }),
}) satisfies z.ZodType<MarkdownCellContentKind>;

const codeCellContentKindSchema = z.object({
  kind: z.literal('Code'),
  spec: z.object({
    language: z.string(),
    code: z.string(),
    highlight: nullableArray(z.number()).optional(),
    annotation: z.string().optional(),
  }),
}) satisfies z.ZodType<CodeCellContentKind>;

const cellContentKindSchema = z.discriminatedUnion('kind', [
  markdownCellContentKindSchema,
  codeCellContentKindSchema,
]) satisfies z.ZodType<CellContentKind>;

const cellKindSchema = z.object({
  kind: z.literal('Cell'),
  spec: z.object({
    content: cellContentKindSchema,
  }),
}) satisfies z.ZodType<CellKind>;

// ---------------------------------------------------------------------------
// Panels
//
// A notebook panel is the dashboard panel with ONE difference, and it is worth being explicit
// about it because "notebook panels are byte-identical to dashboard panels" is the assumption
// the whole capture/round-trip story rests on.
//
// `notebook_spec.cue` sits in the dashboard v2beta1 CUE package, so it inherits that package's
// transformation shape — the id in `kind`, duplicated in `spec.id`. Dashboard v2 (stable) moved
// the id to `group` and dropped `spec.id`. Every other leaf is shared, so only this one is
// restated here, and `transformationCompat` converts at the scene boundary.
//
// INTERIM, matching notebookSpecTransform's NOTEBOOK_WIRE_VERSION: the agreed fix is to reparent
// the notebook spec onto the v2 leaves, at which point this whole section collapses back to
// importing the shared `panelKindSchema`. Blocked on a cog codegen bug, documented there.
// ---------------------------------------------------------------------------

const notebookTransformationKindSchema = z.object({
  // The kind of a v2beta1 TransformationKind IS the transformation id ('organize', 'limit', …).
  kind: z.string(),
  spec: z.object({
    id: z.string(),
    disabled: z.boolean().optional(),
    filter: matcherConfigSchema.optional(),
    topic: z.enum(['series', 'annotations', 'alertStates']).optional(),
    options: z.unknown(),
  }),
}) satisfies z.ZodType<NotebookTransformationKind>;

const notebookQueryGroupKindSchema = z.object({
  kind: z.literal('QueryGroup'),
  spec: z.object({
    queries: nullableArray(panelQueryKindSchema),
    transformations: nullableArray(notebookTransformationKindSchema),
    queryOptions: queryOptionsSpecSchema,
  }),
}) satisfies z.ZodType<NotebookQueryGroupKind>;

const notebookPanelKindSchema = z.object({
  kind: z.literal('Panel'),
  spec: z.object({
    id: z.number(),
    title: z.string(),
    description: z.string().optional(),
    subtitle: z.string().optional(),
    links: nullableArray(dataLinkSchema),
    data: notebookQueryGroupKindSchema,
    vizConfig: vizConfigKindSchema,
    transparent: z.boolean().optional(),
  }),
}) satisfies z.ZodType<NotebookPanelKind>;

/**
 * CellKind is listed first to match the CUE, where a notebook is narrative-first and the first
 * union member is the generated default.
 */
const notebookElementSchema = z.discriminatedUnion('kind', [
  cellKindSchema,
  notebookPanelKindSchema,
  libraryPanelKindSchema,
]) satisfies z.ZodType<NotebookElement>;

// ---------------------------------------------------------------------------
// Layout (flat, ordered — no nesting, unlike every dashboard layout)
// ---------------------------------------------------------------------------

const notebookLayoutItemKindSchema = z.object({
  kind: z.literal('NotebookLayoutItem'),
  spec: z.object({
    element: elementReferenceSchema,
    source: z.enum(['assistant', 'user']),
    collapsed: z.boolean().optional(),
  }),
}) satisfies z.ZodType<NotebookLayoutItemKind>;

const notebookLayoutKindSchema = z.object({
  kind: z.literal('NotebookLayout'),
  spec: z.object({
    cells: nullableArray(notebookLayoutItemKindSchema),
  }),
}) satisfies z.ZodType<NotebookLayoutKind>;

// ---------------------------------------------------------------------------
// Top-level NotebookSpec
// ---------------------------------------------------------------------------

export const notebookSpecSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  tags: nullableArray(z.string()),
  timeSettings: timeSettingsSpecSchema,
  elements: z.preprocess((value) => (value == null ? {} : value), z.record(z.string(), notebookElementSchema)),
  layout: notebookLayoutKindSchema,
}) satisfies z.ZodType<NotebookSpec>;

export interface NotebookSpecValidationResult {
  success: boolean;
  /** Field-scoped messages, `<path>: <message>`, in the shape callers surface to a user or agent. */
  errors: string[];
  /** The parsed spec (defaults filled, nil slices normalized) — present only on success. */
  data?: NotebookSpec;
}

/**
 * Structural validation plus referential integrity.
 *
 * Zod alone cannot catch the notebook's most damaging malformation: a layout cell that
 * references an element name absent from `elements`. Such a spec is structurally valid, saves
 * cleanly, and renders as a silently missing cell. The reverse (an element no cell references)
 * is an orphan that never renders, which is worth reporting for the same reason. Both are
 * checked here rather than in the schema so the schema stays a pure shape definition that
 * composes into other schemas.
 */
export function validateNotebookSpec(spec: unknown): NotebookSpecValidationResult {
  const parsed = notebookSpecSchema.safeParse(spec);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- parsed output matches the notebook spec
  const data = parsed.data as unknown as NotebookSpec;
  const errors: string[] = [];
  const elementNames = new Set(Object.keys(data.elements));
  const referenced = new Set<string>();

  data.layout.spec.cells.forEach((cell, index) => {
    const name = cell.spec.element.name;
    referenced.add(name);
    if (!elementNames.has(name)) {
      errors.push(`layout.spec.cells.${index}.spec.element.name: no element named "${name}" exists in elements`);
    }
  });

  for (const name of elementNames) {
    if (!referenced.has(name)) {
      errors.push(`elements.${name}: not referenced by any cell in layout.spec.cells, so it will not render`);
    }
  }

  return errors.length > 0 ? { success: false, errors } : { success: true, errors: [], data };
}
