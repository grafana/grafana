/**
 * APPLY_NOTEBOOK_SPEC — replace the notebook with a complete `NotebookSpec`, the write half of the
 * notebook full-spec surface (paired with GET_NOTEBOOK_SPEC). A caller reads the spec, edits the JSON,
 * and applies the whole thing back instead of emitting a long sequence of granular
 * ADD / UPDATE / MOVE / REMOVE commands.
 *
 * The scene is rebuilt from the spec through the notebook's own transform and swapped onto the live
 * NotebookScene in place (the pattern `JsonModelEditView.onSaveSuccess` uses for a dashboard). Being a
 * full rebuild-and-swap, it resets transient runtime state (in-flight queries, scroll position).
 *
 * In memory only. Saving is the caller's, and there is no notebook save flow yet.
 */

import * as z from 'zod';

import { sceneUtils } from '@grafana/scenes';
import { type MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';

import { notebookResourceFor } from '../../api/notebookResource';
import { type NotebookScene } from '../../scene/NotebookScene';
import { validateNotebookSpec } from '../../schema/notebookSpecSchema';
import { transformNotebookSceneToSaveModel } from '../../serialization/transformNotebookSceneToSaveModel';
import { transformNotebookToScene } from '../../serialization/transformNotebookToScene';
import { type Spec as NotebookSpec } from '../../types';

import { requiresNotebookEdit } from './permissions';

/**
 * Said rather than returning nothing when the check could not run at all. An empty warning list reads as
 * "every cell survived", and this is the case where the one check this command exists to run is the one
 * that did not happen.
 */
const UNKNOWN_SURVIVORS_WARNING =
  'The notebook could not be checked after the write, so it is unknown which cells survived it.';

/**
 * Cells that were asked for and are not in the notebook that came back.
 *
 * A write can lose a cell and still succeed: `deserializeNotebookLayout` skips a reference it cannot
 * resolve rather than failing, so a spec whose layout names an element that is not in `elements`
 * renders one cell short. `validate: true` catches that particular case, but it checks the REQUEST,
 * and only the OUTCOME shows which cells actually survived. So the result says so rather than leaving
 * the caller to notice on its next read — or not notice, and write the loss back.
 */
function droppedCellWarnings(requested: NotebookSpec, applied: NotebookSpec): string[] {
  const cellNames = (spec: NotebookSpec) => spec.layout.spec.cells.map((cell) => cell.spec.element.name);
  const survived = new Set(cellNames(applied));
  const dropped = [...new Set(cellNames(requested))].filter((name) => !survived.has(name));

  return dropped.length > 0
    ? [`These cells were not applied and are missing from the notebook: ${dropped.join(', ')}.`]
    : [];
}

// Strict, unlike the dashboard APPLY_SPEC it otherwise mirrors. The cost of a silently ignored key is
// not symmetric: mistype `validate` here and the spec applies with validation off, which is exactly the
// path that loses a cell — the failure this command exists to catch. Rejecting `validat` is cheaper
// than reporting the dropped cell afterwards.
const applyNotebookSpecPayloadSchema = z
  .object({
    spec: z
      .record(z.string(), z.unknown())
      .describe('A complete notebook spec to apply (the same shape GET_NOTEBOOK_SPEC returns).'),
    validate: z
      .boolean()
      .optional()
      .default(false)
      .describe('When true, validate the spec against the notebook schema and reject the mutation if it is invalid.'),
  })
  .strict();

export type ApplyNotebookSpecPayload = z.infer<typeof applyNotebookSpecPayloadSchema>;

export const applyNotebookSpecCommand: MutationCommand<ApplyNotebookSpecPayload, NotebookScene> = {
  name: 'APPLY_NOTEBOOK_SPEC',
  description:
    'Replace the notebook with a complete NotebookSpec: settings, elements (markdown, code, panel and ' +
    'library panel cells) and the ordered NotebookLayout that places them. The scene is rebuilt from ' +
    'the spec. The change is in memory and is not saved.',

  payloadSchema: applyNotebookSpecPayloadSchema,
  permission: requiresNotebookEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      // Opt-in validation: reject before mutating and hand back field-scoped messages the caller can
      // self-correct on. The notebook check also covers referential integrity, which zod alone cannot
      // express — a cell pointing at a missing element is structurally valid and renders as a silently
      // absent cell.
      const warnings: string[] = [];
      let notebookSpec: NotebookSpec;
      if (payload.validate) {
        const result = validateNotebookSpec(payload.spec);
        if (!result.success || !result.data) {
          return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
        }
        warnings.push(...result.warnings);
        // Apply the PARSED spec: the schema normalizes Go's `null` slices to `[]`, `elements: null` to
        // `{}`, and fills CUE `*` defaults, so the scene is rebuilt from the same shape validation saw.
        notebookSpec = result.data;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the transform
        notebookSpec = payload.spec as unknown as NotebookSpec;
      }

      // The same transform the page loader uses, so an applied spec and a loaded one cannot produce
      // different scenes. It rebuilds the document header from the spec too, so nothing has to be put
      // back by hand afterwards.
      const rebuilt = transformNotebookToScene(notebookResourceFor(scene.state.uid, notebookSpec));

      // Reuse the live key so existing references (incl. the mutation client's `scene`) survive the
      // swap.
      scene.setState(sceneUtils.cloneSceneObjectState(rebuilt.state, { key: scene.state.key }));

      // Echo the re-serialized spec so the caller sees what landed without a follow-up read, and check
      // it for dropped cells. One guard around both: from here on this reports on a write that already
      // landed, so nothing below may turn it into `success: false`, which would say nothing happened to
      // a notebook that has already changed. The comparison is inside it because on the unvalidated path
      // the spec it reads is a caller-supplied cast.
      let appliedNotebook: NotebookSpec | undefined;
      try {
        appliedNotebook = transformNotebookSceneToSaveModel(scene);
        warnings.push(...droppedCellWarnings(notebookSpec, appliedNotebook));
      } catch {
        warnings.push(UNKNOWN_SURVIVORS_WARNING);
      }

      return {
        success: true,
        data: { applied: true, spec: appliedNotebook },
        changes: [],
        warnings: warnings.length > 0 ? warnings : undefined,
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
