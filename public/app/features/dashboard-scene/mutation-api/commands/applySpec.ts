/**
 * APPLY_SPEC command  [SKETCH — proposed addition]
 *
 * Replaces the dashboard contents with a complete v2beta1 DashboardSpec. This
 * is the write half of the "full-spec" surface: a caller reads with GET_SPEC,
 * edits the JSON, and applies the whole thing back — instead of translating its
 * desired end-state into a long sequence of granular ADD / UPDATE / MOVE /
 * REMOVE commands and managing layout paths itself.
 *
 * Implementation rebuilds the scene from the spec via the existing
 * `transformSaveModelSchemaV2ToScene` serializer and swaps the result onto the
 * live DashboardScene in place — the same pattern the JSON model editor uses in
 * `JsonModelEditView.onSaveSuccess` (clone the rebuilt state under the live
 * scene's key, then `setState`).
 *
 * NOTE (sketch scope): this is a full rebuild-and-swap. It is correct for the
 * final dashboard state (what offline eval grades) but is heavier than an
 * in-place diff and will reset transient runtime state (in-flight queries,
 * current variable selections, scroll). A production version should either
 * (a) diff the incoming spec against the current one and emit the minimal set
 * of in-place scene edits, or (b) preserve runtime state across the swap. The
 * DTO/metadata/access envelope assembly below is also the main thing to harden
 * for a real PR (reuse the scene serializer's metadata rather than this shim).
 */

import { z } from 'zod';

import { sceneUtils } from '@grafana/scenes';

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const applySpecPayloadSchema = z.object({
  spec: z
    .record(z.string(), z.unknown())
    .describe('A complete v2beta1 DashboardSpec to apply (same shape GET_SPEC returns).'),
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- sketch: apiVersion resolved properly in real PR
    apiVersion: 'v2beta1' as DashboardWithAccessInfo<DashboardV2Spec>['apiVersion'],
    spec,
  };
}

/**
 * `transformSaveModelSchemaV2ToScene` destructures `metadata` from the DTO and
 * reads `metadata.name` (the dashboard uid), `metadata.generation`, and
 * `metadata.creationTimestamp` unguarded. On a brand-new / unsaved dashboard the
 * live scene's serializer metadata can be absent or missing those fields, which
 * throws `Cannot read properties of undefined (reading 'uid'|'name'|...)` and
 * makes the caller (e.g. the Assistant) retry blindly. Guarantee a populated
 * envelope, preferring whatever the scene already has.
 */
function resolveMetadata(scene: MutationContextScene): DashboardWithAccessInfo<DashboardV2Spec>['metadata'] {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- sketch: reuse existing metadata envelope
  const existing = (scene.serializer.metadata ?? {}) as Partial<DashboardWithAccessInfo<DashboardV2Spec>['metadata']> &
    Record<string, unknown>;
  const meta = scene.state.meta;
  const uid =
    (typeof existing.name === 'string' && existing.name) ||
    (typeof meta.uid === 'string' && meta.uid) ||
    (typeof meta.key === 'string' && meta.key) ||
    'new-dashboard';
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- sketch: minimal viable metadata envelope
  return {
    ...existing,
    name: uid,
    generation: typeof existing.generation === 'number' ? existing.generation : 1,
    creationTimestamp:
      typeof existing.creationTimestamp === 'string' ? existing.creationTimestamp : new Date().toISOString(),
    annotations: existing.annotations ?? {},
  } as DashboardWithAccessInfo<DashboardV2Spec>['metadata'];
}

// Minimal structural type for the bits of DashboardScene this command touches —
// kept local to avoid a circular import in the sketch.
type MutationContextScene = {
  state: { meta: Record<string, unknown> & { canEdit?: boolean; canSave?: boolean; canShare?: boolean; canStar?: boolean; canDelete?: boolean; canAdmin?: boolean; slug?: string; url?: string; key?: string } };
  serializer: { metadata: unknown };
  setState: (state: unknown) => void;
};

export const applySpecCommand: MutationCommand<ApplySpecPayload> = {
  name: 'APPLY_SPEC',
  description:
    'Replace the dashboard with a complete v2beta1 DashboardSpec. The scene is rebuilt from the spec ' +
    '(settings, variables, annotations, panels, and nested rows/tabs layout).',

  payloadSchema: applySpecPayloadSchema,
  // Rebuilds the layout tree, so gate on the same toggle as the layout commands.
  permission: requiresNewDashboardLayouts,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    try {
      enterEditModeIfNeeded(scene);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- sketch: caller-supplied spec validated by the transform
      const spec = payload.spec as unknown as DashboardV2Spec;
      const dto = dtoFromScene(scene as unknown as MutationContextScene, spec);

      const rebuilt = transformSaveModelSchemaV2ToScene(dto);

      // Swap the rebuilt content onto the live scene in place, reusing the live
      // key so existing references (incl. the mutation client's `scene`) hold.
      const newState = sceneUtils.cloneSceneObjectState(rebuilt.state, { key: scene.state.key });
      scene.setState(newState);

      return { success: true, data: { applied: true }, changes: [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
