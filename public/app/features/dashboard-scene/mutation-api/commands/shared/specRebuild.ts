/**
 * The rebuild-and-swap shared by the full-spec write commands.
 *
 * In `shared/` because both resources go through it, and that is the point: the notebook widens its
 * spec to the dashboard shape before calling rather than having a rebuild of its own, so there is
 * exactly one place where a document is replaced and the two cannot drift. Anything else both
 * resources come to share belongs here beside it.
 */

import { sceneUtils } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type ObjectMeta } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import type { DashboardScene } from '../../../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../../../serialization/transformSaveModelSchemaV2ToScene';

// The parts of DashboardScene a rebuild actually touches. Naming them keeps the module honest about
// its reach, and is what lets a caller's test drive this with a small stub instead of a real scene.
type RebuildTargetScene = {
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
 * Wrap a bare spec in the access/metadata envelope `transformSaveModelSchemaV2ToScene`
 * expects, reusing the live scene's metadata + access so identity and
 * permissions survive the rebuild.
 */
function dtoFromScene(scene: RebuildTargetScene, spec: DashboardV2Spec): DashboardWithAccessInfo<DashboardV2Spec> {
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
function resolveMetadata(scene: RebuildTargetScene): DashboardWithAccessInfo<DashboardV2Spec>['metadata'] {
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

/**
 * Rebuild the scene from a dashboard-shaped spec and swap it in place.
 *
 * `preserveMeta` carries forward the meta flags the caller owns rather than the save model — the
 * notebook page sets `isEmbedded` after loading, and a rebuild would otherwise drop it and reveal the
 * dashboard edit chrome on a page that is meant to be read-only to hand editing.
 *
 * The element map has to be reseeded by hand afterwards. `transformSaveModelSchemaV2ToScene` seeds
 * the map of the scene it builds, but only that scene's *state* is cloned over and the serializer
 * hangs off the scene object, so the live map would keep what load put there. It then resolves every
 * element the applied spec added to `panel-<id>` and stores that, leaving the layout referencing a
 * name the elements no longer use. `initializeElementMapping` clears before it seeds, so the reseed
 * also undoes any wrong entry an earlier read cached. Deliberately not `setInitialSaveModel`, which
 * would additionally reset the unsaved-changes baseline and change how dashboards detect dirty state.
 */
export function rebuildSceneFromSpec(
  dashboardScene: DashboardScene,
  spec: DashboardV2Spec,
  preserveMeta?: Record<string, unknown>
): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrow DashboardScene to the fields a rebuild reads
  const scene = dashboardScene as unknown as RebuildTargetScene;

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
