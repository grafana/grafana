/**
 * APPLY_SPEC — replace the document with a complete spec, the write half of the
 * full-spec surface (paired with GET_SPEC). A caller reads the spec, edits the
 * JSON, and applies the whole thing back instead of emitting a long sequence of
 * granular ADD / UPDATE / MOVE / REMOVE commands.
 *
 * Rebuilds the scene from the spec via `transformSaveModelSchemaV2ToScene` and
 * swaps the result onto the live DashboardScene in place (the pattern
 * `JsonModelEditView.onSaveSuccess` uses). Being a full rebuild-and-swap, it
 * resets transient runtime state (in-flight queries, variable selections,
 * scroll position).
 *
 * A notebook is accepted too, by forwarding to APPLY_NOTEBOOK_SPEC. That is
 * compatibility rather than design: the assistant plugin is released on its own
 * schedule and looks for this command by name when it decides whether a page can
 * be edited at all, so refusing a notebook here would break notebook pages for
 * every plugin version already out there.
 */

import * as z from 'zod';

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { isNotebookScene } from '../../serialization/notebookSpecTransform';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardV2SpecSchema } from '../../v2schema/dashboardV2Schema';

import { applyNotebookSpecCommand } from './applyNotebookSpec';
import { rebuildSceneFromSpec } from './specRebuild';
import { enterEditModeIfNeeded, requiresSpecWrite, type MutationCommand } from './types';

const applySpecPayloadSchema = z.object({
  spec: z
    .record(z.string(), z.unknown())
    .describe('A complete spec to apply (same shape and resource GET_SPEC returns).'),
  validate: z
    .boolean()
    .optional()
    .default(false)
    .describe('When true, validate the spec against its schema and reject the mutation if it is invalid.'),
});

export type ApplySpecPayload = z.infer<typeof applySpecPayloadSchema>;

export const applySpecCommand: MutationCommand<ApplySpecPayload> = {
  name: 'APPLY_SPEC',
  description:
    'Replace the dashboard with a complete v2 DashboardSpec: settings, variables, annotations, ' +
    'panels and the nested rows/tabs layout. The scene is rebuilt from the spec. Also accepted on ' +
    'a notebook, where the payload is a v2beta1 NotebookSpec and APPLY_NOTEBOOK_SPEC is the ' +
    'command to prefer.',

  payloadSchema: applySpecPayloadSchema,
  // Rebuilds the layout tree, so a dashboard gates on the same toggle as the layout commands;
  // a notebook has its own rule (the dashboard one refuses every notebook write).
  permission: requiresSpecWrite,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      // Compatibility forward, see the docstring for why it cannot simply refuse. This branch goes
      // when no released assistant plugin version still asks for APPLY_SPEC on a notebook page.
      if (isNotebookScene(scene)) {
        return applyNotebookSpecCommand.handler(payload, context);
      }

      // Opt-in structural validation (default off to avoid breaking existing
      // callers). When enabled, reject an invalid spec before mutating anything.
      // On success we apply the *parsed* spec: the schema normalizes Go's
      // `null` slices to `[]`, `elements: null` to `{}`, and fills CUE `*`
      // defaults, so the scene is rebuilt from the same shape validation saw.
      let validatedSpec: DashboardV2Spec | undefined;
      if (payload.validate) {
        const parsed = dashboardV2SpecSchema.safeParse(payload.spec);
        if (!parsed.success) {
          const errorMessages = parsed.error.issues.map((issue) => {
            const path = issue.path.join('.');
            return path ? `${path}: ${issue.message}` : issue.message;
          });
          return { success: false, error: `Validation failed: ${errorMessages.join(', ')}`, changes: [] };
        }
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- parsed output matches the v2 spec the transform expects
        validatedSpec = parsed.data as unknown as DashboardV2Spec;
      }

      enterEditModeIfNeeded(scene);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the transform
      const spec = validatedSpec ?? (payload.spec as unknown as DashboardV2Spec);
      rebuildSceneFromSpec(scene, spec);

      // Return the re-serialized spec so the caller can see what landed without a follow-up
      // GET_SPEC. Element names it chose come back unchanged, since the rebuild reseeds the map.
      // Best effort: a serialization failure still reports success.
      let appliedSpec: DashboardV2Spec | undefined;
      try {
        appliedSpec = transformSceneToSaveModelSchemaV2(scene);
      } catch {
        appliedSpec = undefined;
      }

      return { success: true, data: { applied: true, spec: appliedSpec, resource: 'dashboard' }, changes: [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
