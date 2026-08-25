/**
 * APPLY_NOTEBOOK_SPEC, the write half of the notebook full-spec surface (paired with
 * GET_NOTEBOOK_SPEC): replace the notebook with a complete `NotebookSpec` instead of emitting a long
 * sequence of granular ADD / UPDATE / MOVE / REMOVE commands. The scene is rebuilt from the spec and
 * swapped onto the live NotebookScene in place (as `JsonModelEditView.onSaveSuccess` does for a
 * dashboard), so transient runtime state (in-flight queries, scroll position) is reset.
 *
 * After the swap it hands the change to the notebook's autosave and waits for the write. The scene's own
 * change signal only counts while the notebook is being edited, and there is no edit mode to enter from
 * here.
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

/** Said rather than nothing: an empty warning list would read as "every cell survived". */
const UNKNOWN_SURVIVORS_WARNING =
  'The notebook could not be checked after the write, so it is unknown which cells survived it.';

/**
 * Cells that were asked for and are not in the notebook that came back. A write can lose a cell and
 * still succeed: `deserializeNotebookLayout` skips a reference it cannot resolve rather than failing, so
 * a spec whose layout names an element that is not in `elements` renders one cell short. `validate: true`
 * catches that case, but it checks the REQUEST, and only the OUTCOME shows which cells survived.
 */
function droppedCellWarnings(requested: NotebookSpec, applied: NotebookSpec): string[] {
  const cellNames = (spec: NotebookSpec) => spec.layout.spec.cells.map((cell) => cell.spec.element.name);
  const survived = new Set(cellNames(applied));
  const dropped = [...new Set(cellNames(requested))].filter((name) => !survived.has(name));

  return dropped.length > 0
    ? [`These cells were not applied and are missing from the notebook: ${dropped.join(', ')}.`]
    : [];
}

// Strict, unlike the dashboard APPLY_SPEC it otherwise mirrors: mistype `validate` here and the spec
// applies with validation off, which is exactly the path that loses a cell.
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
    'the spec. The change is saved automatically.',

  payloadSchema: applyNotebookSpecPayloadSchema,
  permission: requiresNotebookEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      const warnings: string[] = [];
      let notebookSpec: NotebookSpec;
      if (payload.validate) {
        const result = validateNotebookSpec(payload.spec);
        if (!result.success || !result.data) {
          return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
        }
        warnings.push(...result.warnings);
        // The PARSED spec: the schema normalizes Go's `null` slices and fills CUE `*` defaults, so the
        // scene is rebuilt from the same shape validation saw.
        notebookSpec = result.data;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the transform
        notebookSpec = payload.spec as unknown as NotebookSpec;
      }

      // The same transform the page loader uses, so an applied spec and a loaded one cannot produce
      // different scenes.
      const rebuilt = transformNotebookToScene(notebookResourceFor(scene.state.uid, notebookSpec));

      // Reuse the live key so existing references (incl. the mutation client's `scene`) survive the
      // swap. `setState` merges, so an open overlay would stay mounted still pointing at cells of
      // the tree we just discarded: the rebuilt spec has no overlay, and without clearing it here
      // the modal would keep showing or acting on that discarded content.
      scene.setState({
        ...sceneUtils.cloneSceneObjectState(rebuilt.state, { key: scene.state.key }),
        overlay: undefined,
      });

      // Echo the re-serialized spec so the caller sees what landed, and check it for dropped cells. Both
      // describe the scene rather than the save, so they run before it and one guard covers both: a check
      // that cannot run is a warning, never a failure.
      let appliedNotebook: NotebookSpec | undefined;
      try {
        appliedNotebook = transformNotebookSceneToSaveModel(scene);
        warnings.push(...droppedCellWarnings(notebookSpec, appliedNotebook));
      } catch {
        warnings.push(UNKNOWN_SURVIVORS_WARNING);
      }

      // Waited on rather than left to the debounce: this result is the caller's only signal, and one that
      // said the write succeeded while it was still in flight would report a notebook that never saved.
      try {
        await scene.autosave.saveDocumentChange();
      } catch (error) {
        return {
          success: false,
          // Says which half failed, because they differ: the scene on screen holds the new document, and
          // the server still holds the old one. The notebook offers a Retry.
          error: `The notebook was changed but could not be saved: ${
            error instanceof Error ? error.message : String(error)
          }`,
          data: { applied: true, spec: appliedNotebook },
          changes: [],
          warnings: warnings.length > 0 ? warnings : undefined,
        };
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
