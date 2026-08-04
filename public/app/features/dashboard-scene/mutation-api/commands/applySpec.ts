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

import { sceneUtils } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { type ObjectMeta } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import {
  isNotebookScene,
  notebookSpecToDashboardSpec,
  setNotebookDocumentHeader,
} from '../../serialization/notebookSpecTransform';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToNotebookSaveModel } from '../../serialization/transformSceneToNotebookSaveModel';
import { transformSceneToSaveModelSchemaV2 } from '../../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardV2SpecSchema } from '../../v2schema/dashboardV2Schema';
import { validateNotebookSpec } from '../../v2schema/notebookSpecSchema';

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

/**
 * Wrap a bare spec in the access/metadata envelope `transformSaveModelSchemaV2ToScene`
 * expects, reusing the live scene's metadata + access so identity and
 * permissions survive the rebuild.
 */
function dtoFromScene(scene: MutationContextScene, spec: DashboardV2Spec): DashboardWithAccessInfo<DashboardV2Spec> {
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
  const existing = scene.serializer.getK8SMetadata() ?? {};
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
  state: {
    key?: string;
    meta: Record<string, unknown> & {
      canEdit?: boolean;
      canSave?: boolean;
      canShare?: boolean;
      canStar?: boolean;
      canDelete?: boolean;
      canAdmin?: boolean;
      isEmbedded?: boolean;
      slug?: string;
      url?: string;
      key?: string;
    };
  };
  serializer: {
    getK8SMetadata: () => Partial<ObjectMeta> | undefined;
    initializeElementMapping: (spec: DashboardV2Spec) => void;
  };
  setState: (state: unknown) => void;
};

/**
 * Rebuild the scene from a dashboard-shaped spec and swap it in place.
 *
 * Shared by both resources: the notebook path widens its spec to this shape first, so there is
 * exactly one rebuild-and-swap and the two cannot drift. `preserveMeta` carries forward the meta
 * flags the caller owns rather than the save model — the notebook page sets `isEmbedded` after
 * loading, and a rebuild would otherwise drop it and reveal the dashboard edit chrome on a page
 * that is meant to be read-only to hand editing.
 *
 * The element map has to be reseeded by hand afterwards. `transformSaveModelSchemaV2ToScene` seeds
 * the map of the scene it builds, but only that scene's *state* is cloned over and the serializer
 * hangs off the scene object, so the live map would keep what load put there. It then resolves every
 * element the applied spec added to `panel-<id>` and stores that, leaving the layout referencing a
 * name the elements no longer use. `initializeElementMapping` clears before it seeds, so the reseed
 * also undoes any wrong entry an earlier read cached. Deliberately not `setInitialSaveModel`, which
 * would additionally reset the unsaved-changes baseline and change how dashboards detect dirty state.
 */
function rebuildSceneFromSpec(
  scene: MutationContextScene,
  spec: DashboardV2Spec,
  preserveMeta?: Record<string, unknown>
): void {
  const dto = dtoFromScene(scene, spec);
  const rebuilt = transformSaveModelSchemaV2ToScene(dto);

  // Reuse the live key so existing references (incl. the mutation client's
  // `scene`) survive the swap.
  const newState = sceneUtils.cloneSceneObjectState(rebuilt.state, { key: scene.state.key });
  scene.setState(preserveMeta ? { ...newState, meta: { ...newState.meta, ...preserveMeta } } : newState);

  // Safe on a dashboard still served as v1: its serializer reads `panels`, finds none on a v2 spec,
  // and is left with an empty map, which regenerates the same `panel-<id>` keys it seeds on load.
  scene.serializer.initializeElementMapping(spec);
}

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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrow DashboardScene to the fields this command reads
      const mutationScene = scene as unknown as MutationContextScene;

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
        rebuildSceneFromSpec(mutationScene, notebookSpecToDashboardSpec(notebookSpec), {
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
      rebuildSceneFromSpec(mutationScene, spec);

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
