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
 * The command is resource-polymorphic, mirroring GET_SPEC: on a dashboard scene
 * the payload is a v2 `DashboardSpec`, on a notebook scene a v2beta1
 * `NotebookSpec`. The notebook path widens the spec to the dashboard shape for
 * the transformer, validates against the notebook schema rather than the
 * dashboard one, and skips dashboard edit mode — a notebook has no dashboard
 * edit chrome to enter, and entering it would mount the edit pane over a page
 * that is deliberately read-only to hand editing.
 */

import * as z from 'zod';

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

import {
  isNotebookScene,
  notebookSpecToDashboardSpec,
  setNotebookDocumentHeader,
} from '../../serialization/notebookSpecTransform';
import { transformSceneToNotebookSaveModel } from '../../serialization/transformSceneToNotebookSaveModel';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardV2SpecSchema } from '../../v2schema/dashboardV2Schema';
import { validateNotebookSpec } from '../../v2schema/notebookSpecSchema';

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
    'Replace the document with a complete spec. On a dashboard this is a v2 DashboardSpec ' +
    '(settings, variables, annotations, panels, and nested rows/tabs layout); on a notebook a ' +
    'v2beta1 NotebookSpec (settings, elements including markdown/code cells, and the ordered ' +
    'NotebookLayout). The scene is rebuilt from the spec.',

  payloadSchema: applySpecPayloadSchema,
  // Rebuilds the layout tree, so a dashboard gates on the same toggle as the layout commands;
  // a notebook has its own rule (the dashboard one refuses every notebook write).
  permission: requiresSpecWrite,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      if (isNotebookScene(scene)) {
        // Opt-in validation, same contract as the dashboard path below: reject before mutating
        // and hand back field-scoped messages the caller can self-correct on. The notebook check
        // also covers referential integrity, which zod alone cannot express — a cell pointing at
        // a missing element is structurally valid and renders as a silently absent cell.
        let notebookSpec: NotebookSpec;
        if (payload.validate) {
          const result = validateNotebookSpec(payload.spec);
          if (!result.success || !result.data) {
            return { success: false, error: `Validation failed: ${result.errors.join(', ')}`, changes: [] };
          }
          // Apply the PARSED spec: the schema normalizes Go's `null` slices to `[]`,
          // `elements: null` to `{}`, and fills CUE `*` defaults, so the scene is rebuilt from
          // the same shape validation saw.
          notebookSpec = result.data;
        } else {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unvalidated path: caller-supplied spec is checked by the transform
          notebookSpec = payload.spec as unknown as NotebookSpec;
        }

        // A notebook has no dashboard edit mode to enter — deliberately no enterEditModeIfNeeded.
        rebuildSceneFromSpec(scene, notebookSpecToDashboardSpec(notebookSpec), {
          isEmbedded: scene.state.meta.isEmbedded,
        });
        // The rebuild replaces the layout manager, which holds the document header on its own
        // state, so restore it from the spec that was just applied.
        setNotebookDocumentHeader(scene.state.body, notebookSpec.title, notebookSpec.tags);

        // Echo the re-serialized spec so the caller sees the post-apply element names without a
        // follow-up GET_SPEC. Best effort: a serialization failure still reports success, since
        // the write itself already landed.
        let appliedNotebook: NotebookSpec | undefined;
        try {
          appliedNotebook = transformSceneToNotebookSaveModel(scene);
        } catch {
          appliedNotebook = undefined;
        }

        return { success: true, data: { applied: true, spec: appliedNotebook, resource: 'notebook' }, changes: [] };
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
