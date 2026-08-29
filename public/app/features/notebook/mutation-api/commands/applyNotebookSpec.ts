import * as z from 'zod';

import { sceneUtils } from '@grafana/scenes';
import { type MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';

import { notebookResourceFor } from '../../api/notebookResource';
import { type NotebookScene } from '../../scene/NotebookScene';
import { isEmptyMarkdown } from '../../scene/layout-notebook/isEmptyMarkdown';
import { validateNotebookSpec } from '../../schema/notebookSpecSchema';
import { transformNotebookSceneToSaveModel } from '../../serialization/transformNotebookSceneToSaveModel';
import { type Spec as NotebookSpec } from '../../types';

import { requiresNotebookEdit } from './permissions';

const UNKNOWN_SURVIVORS_WARNING =
  'The notebook could not be checked after the write, so it is unknown which cells survived it.';

function droppedCellWarnings(requested: NotebookSpec, applied: NotebookSpec): string[] {
  const survived = new Set(applied.layout.spec.cells.map((cell) => cell.spec.element.name));
  const dropped = [...new Set(requestedCellNames(requested))].filter((name) => !survived.has(name));

  return dropped.length > 0
    ? [`These cells were not applied and are missing from the notebook: ${dropped.join(', ')}.`]
    : [];
}

// The trailing empty block is excluded because the save model leaves it out too (see
// NotebookLayoutManager.contentCells), so counting it would report a cell as lost when none was.
// `cells` is guarded because the spec comes from the caller, and Go marshals an empty slice as null.
function requestedCellNames(spec: NotebookSpec): string[] {
  const cells = spec.layout.spec.cells ?? [];
  const last = cells[cells.length - 1];
  const lastElement = last ? spec.elements?.[last.spec.element.name] : undefined;
  const endsWithEmptyBlock = lastElement?.kind === 'Cell' && isEmptyMarkdown(lastElement.spec.content);

  return (endsWithEmptyBlock ? cells.slice(0, -1) : cells).map((cell) => cell.spec.element.name);
}

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
        notebookSpec = result.data;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the transform
        notebookSpec = payload.spec as unknown as NotebookSpec;
      }

      const { transformNotebookToScene } = await import(
        /* webpackChunkName: "notebook-serialization" */ '../../serialization/transformNotebookToScene'
      );

      const rebuilt = transformNotebookToScene(notebookResourceFor(scene.state.uid, notebookSpec));

      scene.setState({
        ...sceneUtils.cloneSceneObjectState(rebuilt.state, { key: scene.state.key }),
        overlay: undefined,
      });

      let appliedNotebook: NotebookSpec | undefined;
      try {
        appliedNotebook = transformNotebookSceneToSaveModel(scene);
        warnings.push(...droppedCellWarnings(notebookSpec, appliedNotebook));
      } catch {
        warnings.push(UNKNOWN_SURVIVORS_WARNING);
      }

      try {
        await scene.autosave.saveDocumentChange();
      } catch (error) {
        return {
          success: false,
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
