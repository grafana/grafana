/**
 * CREATE_NOTEBOOK_SPEC, create a NEW notebook from a complete `NotebookSpec` and open it.
 *
 * The odd one out on this surface: a notebook has no blank-editor route the way `/dashboard/new` is one
 * for a dashboard, so the create IS the write. It therefore persists, which is why it validates by
 * default where the others do not, and it reads nothing off the open document, which is why it is the one
 * notebook command also registered on a dashboard's client (it still needs SOME document open, the
 * mutation API being mounted only on a scene).
 */

import * as z from 'zod';

import { locationService } from '@grafana/runtime';
import { type MutationCommand } from 'app/features/dashboard-scene/mutation-api/commands/types';

import { createNotebook } from '../../api/notebookResource';
import { validateNotebookSpec } from '../../schema/notebookSpecSchema';
import { type Spec as NotebookSpec } from '../../types';

import { requiresNotebookCreate } from './permissions';

// Strict, like GET and APPLY, and most of all here: this is the only command on the surface that
// persists, so an ignored key is a saved notebook.
const createNotebookSpecPayloadSchema = z
  .object({
    spec: z
      .record(z.string(), z.unknown())
      .describe('A complete notebook spec to create (the same shape GET_NOTEBOOK_SPEC returns).'),
    validate: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Validate the spec against the notebook schema and reject before writing. On by default here, ' +
          'unlike the other commands, because a create is persisted.'
      ),
    open: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        'Navigate to the new notebook. Turn off to create one without leaving the current page. The ' +
          'response reports `opened`, which is whether the navigation was accepted, not whether the ' +
          'notebook page has finished mounting: the route is loaded lazily, so GET_NOTEBOOK_SPEC and ' +
          'APPLY_NOTEBOOK_SPEC can still reach the previous document for a moment afterwards. Check ' +
          'getAvailableCommands() rather than assuming.'
      ),
  })
  .strict();

export type CreateNotebookSpecPayload = z.infer<typeof createNotebookSpecPayloadSchema>;

export const createNotebookSpecCommand: MutationCommand<CreateNotebookSpecPayload, unknown> = {
  name: 'CREATE_NOTEBOOK_SPEC',
  description:
    'Create a NEW notebook from a complete NotebookSpec and open it: settings, elements (markdown, ' +
    'code, panel and library panel cells) and the ordered NotebookLayout that places them. Unlike the ' +
    'other notebook commands this one is saved immediately and the server assigns the uid. Use ' +
    'APPLY_NOTEBOOK_SPEC to change a notebook that already exists.',

  payloadSchema: createNotebookSpecPayloadSchema,
  permission: requiresNotebookCreate,
  // Not `readOnly: true`: that would skip the payload clone, and this handler hands the spec to a
  // request. It costs a forceRender on the open document, which nothing here changed. The two effects of
  // the flag only come apart on this command. See `readOnly` in the dashboard command types.
  readOnly: false,

  handler: async (payload) => {
    try {
      let spec: NotebookSpec;
      let warnings: string[] = [];
      if (payload.validate) {
        const result = validateNotebookSpec(payload.spec);
        if (!result.success || !result.data) {
          return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
        }
        warnings = result.warnings;
        // The PARSED spec: the schema fills CUE `*` defaults and normalizes absent collections, so what is
        // persisted is the shape validation saw.
        spec = result.data;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the apiserver
        spec = payload.spec as unknown as NotebookSpec;
      }

      const created = await createNotebook(spec);

      let opened = false;
      if (payload.open) {
        locationService.push(created.url);
        // Whether the navigation was accepted, not that it was asked for: a dirty dashboard's
        // unsaved-changes prompt blocks the push. The create itself is saved either way, hence success.
        opened = locationService.getLocation().pathname === created.url;
      }

      return {
        success: true,
        data: { created: true, opened, ...created },
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
