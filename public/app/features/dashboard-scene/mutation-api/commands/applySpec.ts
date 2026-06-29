/**
 * APPLY_SPEC — replace the dashboard with a complete v2 DashboardSpec, the write
 * half of the full-spec surface (paired with GET_SPEC). A caller reads the spec,
 * edits the JSON, and applies the whole thing back instead of emitting a long
 * sequence of granular ADD / UPDATE / MOVE / REMOVE commands.
 *
 * Rebuilds the scene from the spec via `transformSaveModelSchemaV2ToScene` and
 * swaps the result onto the live DashboardScene in place (the pattern
 * `JsonModelEditView.onSaveSuccess` uses). Being a full rebuild-and-swap, it
 * resets transient runtime state (in-flight queries, variable selections,
 * scroll position).
 */

import { z } from 'zod';

import { sceneUtils } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';

import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const applySpecPayloadSchema = z.object({
  spec: z
    .record(z.string(), z.unknown())
    .describe('A complete v2 DashboardSpec to apply (same shape GET_SPEC returns).'),
});

export type ApplySpecPayload = z.infer<typeof applySpecPayloadSchema>;

/**
 * Wrap a bare spec in the access/metadata envelope `transformSaveModelSchemaV2ToScene`
 * expects, reusing the live scene's metadata + access so identity and
 * permissions survive the rebuild.
 */
function dtoFromScene(
  scene: MutationContextScene,
  spec: DashboardV2Spec
): DashboardWithAccessInfo<DashboardV2Spec> {
  const meta = scene.state.meta;
  return {
    kind: 'DashboardWithAccessInfo',
    metadata: resolveMetadata(scene),
    access: {
      canEdit: meta.canEdit !== false,
      canSave: meta.canSave !== false,
      canShare: meta.canShare !== false,
      canStar: meta.canStar !== false,
      canDelete: meta.canDelete !== false,
      canAdmin: meta.canAdmin !== false,
      slug: meta.slug,
      url: meta.url,
    },
    // Whichever v2 version the backend serves (stable v2 or v2beta1). It is
    // stamped onto the scene, so a wrong literal would mislabel it on save.
    apiVersion: dashboardAPIVersionResolver.getV2(),
    spec,
  };
}

/**
 * `transformSaveModelSchemaV2ToScene` reads `metadata.name`/`generation`/
 * `creationTimestamp` unguarded, which throws on a brand-new / unsaved dashboard
 * whose serializer metadata is absent or partial. Guarantee a populated
 * envelope, preferring whatever the scene already has.
 */
function resolveMetadata(scene: MutationContextScene): DashboardWithAccessInfo<DashboardV2Spec>['metadata'] {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrow the scene's untyped serializer metadata
  const existing = (scene.serializer.metadata ?? {}) as Partial<DashboardWithAccessInfo<DashboardV2Spec>['metadata']> &
    Record<string, unknown>;
  const meta = scene.state.meta;
  const uid =
    (typeof existing.name === 'string' && existing.name) ||
    (typeof meta.uid === 'string' && meta.uid) ||
    (typeof meta.key === 'string' && meta.key) ||
    'new-dashboard';
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- assemble the metadata envelope
  return {
    ...existing,
    name: uid,
    generation: typeof existing.generation === 'number' ? existing.generation : 1,
    creationTimestamp:
      typeof existing.creationTimestamp === 'string' ? existing.creationTimestamp : new Date().toISOString(),
    annotations: existing.annotations ?? {},
  } as DashboardWithAccessInfo<DashboardV2Spec>['metadata'];
}

// Minimal structural type for the bits of DashboardScene this command touches,
// kept local to avoid a circular import.
type MutationContextScene = {
  state: { meta: Record<string, unknown> & { canEdit?: boolean; canSave?: boolean; canShare?: boolean; canStar?: boolean; canDelete?: boolean; canAdmin?: boolean; slug?: string; url?: string; key?: string } };
  serializer: { metadata: unknown };
  setState: (state: unknown) => void;
};

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
      enterEditModeIfNeeded(scene);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- caller-supplied spec is validated by the transform
      const spec = payload.spec as unknown as DashboardV2Spec;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrow DashboardScene to the fields this command reads
      const dto = dtoFromScene(scene as unknown as MutationContextScene, spec);

      const rebuilt = transformSaveModelSchemaV2ToScene(dto);

      // Reuse the live key so existing references (incl. the mutation client's
      // `scene`) survive the swap.
      const newState = sceneUtils.cloneSceneObjectState(rebuilt.state, { key: scene.state.key });
      scene.setState(newState);

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
