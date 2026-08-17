/**
 * Canonical Zod schema for the Notebook spec. Mirrors
 * `apps/dashboard/kinds/v2beta1/notebook_spec.cue` with the same conventions as
 * {@link ../../dashboard-scene/v2schema/dashboardV2Schema} (CUE `*value` defaults as
 * `.optional().default(...)`, Go nil slices via `nullableArray`, non-strict objects for forward
 * compatibility, `satisfies z.ZodType<...>` so schema and generated interface cannot drift).
 *
 * The panel, library-panel and time-settings leaves ARE the dashboard v2 ones, so they are imported
 * rather than restated. They are generated into a different module than the notebook types, so
 * `satisfies` is checked against the notebook types while the shared schemas supply the value.
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

// CellKind first, to match the CUE: the first union member is the generated default.
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

// Not exported: `validateNotebookSpec` is the entry point, because a bare shape parse would miss the
// referential check below, which is the malformation that actually costs a cell.
const notebookSpecSchema = z.object({
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
 * rather than failing. So that one is an error, while the reverse (an element no cell references) is
 * only a warning: it is what a spec looks like halfway through an edit that removes a cell, and failing
 * on it would mean a *read* of a notebook someone else saved could not be validated at all.
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
