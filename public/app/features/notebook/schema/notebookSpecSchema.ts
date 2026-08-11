/**
 * Canonical Zod schema for the Notebook spec.
 *
 * Mirrors `apps/dashboard/kinds/v2beta1/notebook_spec.cue` the same way
 * {@link ../../dashboard-scene/v2schema/dashboardV2Schema} mirrors the dashboard v2 CUE, and follows
 * the same conventions (CUE `*value` defaults encoded as `.optional().default(...)`, Go nil slices
 * tolerated via `nullableArray`, non-strict objects for forward compatibility, `satisfies
 * z.ZodType<...>` so the schema and the generated interface cannot drift).
 *
 * A notebook's panel, library-panel and time-settings leaves ARE the dashboard v2 ones, so they are
 * imported rather than restated. That is what makes a panel round-trip between a dashboard, Explore
 * and a notebook, and it is only true because the notebook spec was reparented onto the dashboard v2
 * panel shape. What is notebook-only is `CellKind` (narrative content) and `NotebookLayout` (a flat
 * ordered list of cells).
 *
 * The generated notebook and dashboard leaf types are structurally identical but come from different
 * modules, so `satisfies` is checked against the notebook types while the shared schemas supply the
 * value. Those types come through `features/notebook/types.ts` rather than straight from
 * `@grafana/schema`, so this file moves with the notebook when it goes to a stable v2.
 */

import * as z from 'zod';

import {
  elementReferenceSchema,
  libraryPanelKindSchema,
  nullableArray,
  panelKindSchema,
  timeSettingsSpecSchema,
} from 'app/features/dashboard-scene/v2schema/dashboardV2Schema';

import type {
  CellContentKind,
  CellKind,
  CodeCellContentKind,
  MarkdownCellContentKind,
  NotebookElement,
  NotebookLayoutItemKind,
  NotebookLayoutKind,
  Spec as NotebookSpec,
} from '../types';

// ---------------------------------------------------------------------------
// Narrative cells — the only elements a dashboard has no equivalent for
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

/**
 * CellKind is listed first to match the CUE, where a notebook is narrative-first and the first union
 * member is the generated default.
 */
const notebookElementSchema = z.discriminatedUnion('kind', [
  cellKindSchema,
  panelKindSchema,
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
  /** Field-scoped messages for things that are wrong but not fatal. Present whether or not it passed. */
  warnings: string[];
  /** The parsed spec (defaults filled, nil slices normalized) — present only on success. */
  data?: NotebookSpec;
}

/**
 * Structural validation plus referential integrity.
 *
 * Zod alone cannot catch the notebook's most damaging malformation: a layout cell that references an
 * element name absent from `elements`. Such a spec is structurally valid, saves cleanly, and renders
 * as a silently missing cell, because `deserializeNotebookLayout` skips a reference it cannot resolve
 * rather than failing. So that one is an error.
 *
 * The reverse — an element no cell references — is an orphan that never renders, and it is a warning
 * rather than an error. It costs the reader nothing, it is what a spec looks like halfway through an
 * edit that removes a cell, and failing on it would mean a *read* of a notebook someone else saved
 * could not be validated at all.
 *
 * Both are checked here rather than in the schema, so the schema stays a pure shape definition that
 * composes into other schemas.
 */
export function validateNotebookSpec(spec: unknown): NotebookSpecValidationResult {
  const parsed = notebookSpecSchema.safeParse(spec);
  if (!parsed.success) {
    return {
      success: false,
      warnings: [],
      errors: parsed.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    };
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- parsed output matches the notebook spec
  const data = parsed.data as unknown as NotebookSpec;
  const errors: string[] = [];
  const warnings: string[] = [];
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
      warnings.push(`elements.${name}: not referenced by any cell in layout.spec.cells, so it will not render`);
    }
  }

  return errors.length > 0 ? { success: false, errors, warnings } : { success: true, errors: [], warnings, data };
}
