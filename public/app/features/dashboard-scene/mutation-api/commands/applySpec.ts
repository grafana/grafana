/**
 * APPLY_SPEC — replace the dashboard with a complete v2 DashboardSpec, the write
 * half of the full-spec surface (paired with GET_SPEC). A caller reads the spec,
 * edits the JSON, and applies the whole thing back instead of emitting a long
 * sequence of granular ADD / UPDATE / MOVE / REMOVE commands.
 *
 * Rebuilds the scene from the spec via `transformSaveModelSchemaV2ToScene` and
 * swaps the result onto the live DashboardScene in place (the pattern
 * `JsonModelEditView.onSaveSuccess` uses). Being a full rebuild-and-swap, it
 * resets transient runtime state (in-flight queries, scroll position); the
 * url-synced part of that state is re-initialized from the URL after the swap.
 */

import * as z from 'zod';

import { t } from '@grafana/i18n';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { applyDashboardSpec } from '../../actions/dashboard/applyDashboardSpec';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardV2SpecSchema } from '../../v2schema/dashboardV2Schema';

import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const applySpecPayloadSchema = z.object({
  spec: z
    .record(z.string(), z.unknown())
    .describe('A complete v2 DashboardSpec to apply (same shape GET_SPEC returns).'),
  validate: z
    .boolean()
    .optional()
    .default(false)
    .describe('When true, validate the spec against the v2 schema and reject the mutation if it is invalid.'),
});

export type ApplySpecPayload = z.infer<typeof applySpecPayloadSchema>;

export const applySpecCommand: MutationCommand<ApplySpecPayload> = {
  name: 'APPLY_SPEC',
  description:
    'Replace the dashboard with a complete v2 DashboardSpec. The scene is rebuilt from the spec ' +
    '(settings, variables, annotations, panels, and nested rows/tabs layout).',

  payloadSchema: applySpecPayloadSchema,
  // Rebuilds the layout tree, so gate on the same toggle as the layout commands.
  permission: requiresNewDashboardLayouts,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
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

      applyDashboardSpec({
        scene,
        spec,
        description: t('dashboard.mutation-api.apply-spec.undo-title', 'Assistant schema edit'),
      });

      // Return the re-serialized spec so the caller gets the rekeyed element
      // names (rebuild rekeys to `panel-<id>`) without a follow-up GET_SPEC.
      // Best effort: a serialization failure still reports success.
      let appliedSpec: DashboardV2Spec | undefined;
      try {
        appliedSpec = transformSceneToSaveModelSchemaV2(scene);
      } catch {
        appliedSpec = undefined;
      }

      return { success: true, data: { applied: true, spec: appliedSpec }, changes: [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
