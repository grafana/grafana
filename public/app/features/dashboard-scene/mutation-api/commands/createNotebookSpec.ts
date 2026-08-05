/**
 * CREATE_NOTEBOOK_SPEC — create a NEW notebook from a complete v2beta1 `NotebookSpec` and open it.
 *
 * The odd one out on this surface, and for one reason: there is no blank notebook to write into.
 * `create_dashboard_spec` on the assistant side navigates to `/dashboard/new`, which mounts a scene,
 * and then applies a spec onto it; a notebook has no such route, so the create IS the write. The spec
 * is POSTed to the notebooks resource, the apiserver assigns the uid, and the browser navigates to
 * the notebook page — where GET_NOTEBOOK_SPEC and APPLY_NOTEBOOK_SPEC take over for every further
 * edit.
 *
 * Two consequences worth stating rather than discovering:
 * - It persists. Every other command on this surface mutates a scene and leaves saving to the user;
 *   this one writes a resource. So it validates by default, where the others do not.
 * - It does not touch `context.scene`, and does not require the open document to be a notebook. It
 *   still needs SOME document open, because the mutation API is only mounted on a scene — creating
 *   the first notebook from a page with no dashboard scene is not reachable here and stays with the
 *   caller's own REST path.
 */

import * as z from 'zod';

import { locationService } from '@grafana/runtime';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { createNotebook } from 'app/features/notebook/api/notebookResource';
import { validateNotebookSpec } from 'app/features/notebook/schema/notebookSpecSchema';

import { requiresNotebookCreate, type MutationCommand } from './types';

const createNotebookSpecPayloadSchema = z.object({
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
    .describe('Navigate to the new notebook. Turn off to create one without leaving the current page.'),
});

export type CreateNotebookSpecPayload = z.infer<typeof createNotebookSpecPayloadSchema>;

export const createNotebookSpecCommand: MutationCommand<CreateNotebookSpecPayload> = {
  name: 'CREATE_NOTEBOOK_SPEC',
  description:
    'Create a NEW notebook from a complete v2beta1 NotebookSpec and open it: settings, elements ' +
    '(markdown, code, panel and library panel cells) and the ordered NotebookLayout that places ' +
    'them. Unlike the other commands this one is saved immediately and the server assigns the uid. ' +
    'Use APPLY_NOTEBOOK_SPEC to change a notebook that already exists.',

  payloadSchema: createNotebookSpecPayloadSchema,
  permission: requiresNotebookCreate,
  // Nothing on the open scene changes, so there is nothing to re-render. Not `readOnly: true` either:
  // that would skip the payload clone, and this handler hands the spec to a request.
  readOnly: false,

  handler: async (payload) => {
    try {
      let spec: NotebookSpec;
      if (payload.validate) {
        const result = validateNotebookSpec(payload.spec);
        if (!result.success || !result.data) {
          return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
        }
        // Write the PARSED spec: the schema fills the CUE `*` defaults and normalizes absent
        // collections, so what is persisted is the shape validation saw.
        spec = result.data;
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the apiserver
        spec = payload.spec as unknown as NotebookSpec;
      }

      const created = await createNotebook(spec);

      if (payload.open) {
        locationService.push(created.url);
      }

      return { success: true, data: { created: true, ...created }, changes: [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
