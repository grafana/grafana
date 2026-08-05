/**
 * APPLY_NOTEBOOK_SPEC — replace the notebook with a complete v2beta1 `NotebookSpec`, the write half
 * of the notebook full-spec surface (paired with GET_NOTEBOOK_SPEC). A caller reads the spec, edits
 * the JSON, and applies the whole thing back instead of emitting a long sequence of granular
 * ADD / UPDATE / MOVE / REMOVE commands.
 *
 * The spec is widened to the dashboard shape for the transformer, because the scene a notebook rides
 * is dashboard-typed, and then rebuilt through the one rebuild-and-swap both resources share
 * (`rebuildSceneFromSpec`). Being a full rebuild, it resets transient runtime state (in-flight
 * queries, variable selections, scroll position).
 *
 * Three things a notebook needs that a dashboard apply does not, all of which look like details and
 * are each a visible bug if dropped: it never enters dashboard edit mode, it carries `isEmbedded`
 * across the rebuild, and it puts the document header back afterwards.
 */

import * as z from 'zod';

import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { validateNotebookSpec } from 'app/features/notebook/schema/notebookSpecSchema';
import {
  notebookSpecToDashboardSpec,
  setNotebookDocumentHeader,
} from 'app/features/notebook/serialization/notebookSpecTransform';
import { transformSceneToNotebookSaveModel } from 'app/features/notebook/serialization/transformSceneToNotebookSaveModel';

import { rebuildSceneFromSpec } from './shared/specRebuild';
import { requiresNotebookEdit, type MutationCommand } from './types';

/**
 * Cells that were asked for and are not in the notebook that came back.
 *
 * A write can lose a cell and still succeed: the deserializer skips a reference it cannot resolve
 * rather than failing, so a spec whose layout names an element that is not in `elements` renders one
 * cell short. `validate: true` catches that particular case, but it checks the REQUEST, and only the
 * OUTCOME shows which cells actually survived. So the result says so rather than leaving the caller
 * to notice on its next read — or not notice, and write the loss back.
 */
function droppedCellWarnings(requested: NotebookSpec, applied: NotebookSpec | undefined): string[] {
  if (!applied) {
    return [];
  }
  const cellNames = (spec: NotebookSpec) => spec.layout.spec.cells.map((cell) => cell.spec.element.name);
  const survived = new Set(cellNames(applied));
  const dropped = [...new Set(cellNames(requested))].filter((name) => !survived.has(name));

  return dropped.length > 0
    ? [`These cells were not applied and are missing from the notebook: ${dropped.join(', ')}.`]
    : [];
}

const applyNotebookSpecPayloadSchema = z.object({
  spec: z
    .record(z.string(), z.unknown())
    .describe('A complete notebook spec to apply (the same shape GET_NOTEBOOK_SPEC returns).'),
  validate: z
    .boolean()
    .optional()
    .default(false)
    .describe('When true, validate the spec against the notebook schema and reject the mutation if it is invalid.'),
});

export type ApplyNotebookSpecPayload = z.infer<typeof applyNotebookSpecPayloadSchema>;

export const applyNotebookSpecCommand: MutationCommand<ApplyNotebookSpecPayload> = {
  name: 'APPLY_NOTEBOOK_SPEC',
  description:
    'Replace the notebook with a complete v2beta1 NotebookSpec: settings, elements (markdown, code, ' +
    'panel and library panel cells) and the ordered NotebookLayout that places them. The scene is ' +
    'rebuilt from the spec.',

  payloadSchema: applyNotebookSpecPayloadSchema,
  permission: requiresNotebookEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      // Opt-in validation: reject before mutating and hand back field-scoped messages the caller can
      // self-correct on. The notebook check also covers referential integrity, which zod alone
      // cannot express — a cell pointing at a missing element is structurally valid and renders as a
      // silently absent cell.
      let notebookSpec: NotebookSpec;
      if (payload.validate) {
        const result = validateNotebookSpec(payload.spec);
        if (!result.success || !result.data) {
          return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
        }
        // Apply the PARSED spec: the schema normalizes Go's `null` slices to `[]`,
        // `elements: null` to `{}`, and fills CUE `*` defaults, so the scene is rebuilt from the
        // same shape validation saw.
        notebookSpec = result.data;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the transform
        notebookSpec = payload.spec as unknown as NotebookSpec;
      }

      // A notebook has no dashboard edit mode to enter — deliberately no enterEditModeIfNeeded.
      rebuildSceneFromSpec(scene, notebookSpecToDashboardSpec(notebookSpec), {
        isEmbedded: scene.state.meta.isEmbedded,
      });
      // The rebuild replaces the layout manager, which holds the document header on its own state,
      // so restore it from the spec that was just applied.
      setNotebookDocumentHeader(scene.state.body, notebookSpec.title, notebookSpec.tags);

      // Echo the re-serialized spec so the caller sees the post-apply element names without a
      // follow-up read. Best effort: a serialization failure still reports success, since the write
      // itself already landed.
      let appliedNotebook: NotebookSpec | undefined;
      try {
        appliedNotebook = transformSceneToNotebookSaveModel(scene);
      } catch {
        appliedNotebook = undefined;
      }

      const warnings = droppedCellWarnings(notebookSpec, appliedNotebook);

      return {
        success: true,
        data: { applied: true, spec: appliedNotebook },
        changes: [],
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
