/**
 * Wraps a caller-supplied v2 DashboardSpec in the DashboardWithAccessInfo envelope that
 * `transformSaveModelSchemaV2ToScene` expects, reading identity and permissions off a live
 * DashboardScene. Shared by APPLY_SPEC (mutation-api) and the Edit-As-Code code pane, whose
 * envelopes otherwise differ in ways with no single correct default -- see
 * `BuildDashboardWithAccessInfoOptions`.
 */

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import {
  DASHBOARD_API_GROUP,
  dashboardAPIVersionResolver,
} from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { type DashboardScene } from '../scene/DashboardScene';

export interface BuildDashboardWithAccessInfoOptions {
  /**
   * Which accessor and name-resolution to use for the k8s metadata already on the scene:
   * 'full': `scene.serializer.getK8SMetadata()`, with name falling back through
   * existing.name -> scene.state.uid -> 'new-dashboard' -- APPLY_SPEC's behavior.
   * 'minimal': `scene.serializer.metadata` (matters for a v1-loaded dashboard, where the two
   * accessors return different data -- see the accessor note in resolveMetadata), with name
   * falling back to scene.state.uid, then '' -- the code pane's behavior.
   */
  metadataFields: 'full' | 'minimal';
}

type EnvelopeMetadata = DashboardWithAccessInfo<DashboardV2Spec>['metadata'];
type EnvelopeAccess = DashboardWithAccessInfo<DashboardV2Spec>['access'];

// generation/creationTimestamp get the same "keep existing, else default" treatment in both
// branches below: neither field is read unguarded anywhere downstream (confirmed), so this isn't a
// crash guard -- creationTimestamp defaulting to now (rather than '') avoids rendering as an
// invalid date if ever surfaced in a "created" UI for a brand-new dashboard.

function resolveMetadata(
  scene: DashboardScene,
  fields: BuildDashboardWithAccessInfoOptions['metadataFields']
): EnvelopeMetadata {
  if (fields === 'minimal') {
    // `.metadata` (not `getK8SMetadata()`) to match the code pane's existing accessor exactly --
    // differs for a v1-loaded dashboard, where `.metadata` is the whole (non-k8s-shaped)
    // DashboardMeta object and `getK8SMetadata()` extracts just its nested k8s slice.
    const existing = scene.serializer.metadata ?? {};
    // `.metadata` is `DashboardMeta | ObjectMeta` -- a v1-serializer DashboardMeta has neither
    // field, so this only ever reads a real value for a v2-serializer scene; the `?? default`
    // still applies correctly either way.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrow to read potential k8s fields off a metadata object that may be the non-k8s-shaped v1 DashboardMeta
    const existingK8sFields = existing as Partial<EnvelopeMetadata>;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- assemble the metadata envelope
    return {
      name: scene.state.uid ?? '',
      ...existing,
      generation: typeof existingK8sFields.generation === 'number' ? existingK8sFields.generation : 1,
      creationTimestamp:
        typeof existingK8sFields.creationTimestamp === 'string'
          ? existingK8sFields.creationTimestamp
          : new Date().toISOString(),
    } as EnvelopeMetadata;
  }

  const existing = scene.serializer.getK8SMetadata() ?? {};
  // scene.state.meta.uid is not a useful fallback here: it's only ever populated in the same
  // operation that also populates existing.name, so by the time it would be defined, existing.name
  // already is too -- scene.state.uid is set far earlier (on every scene-construction path).
  const name = (typeof existing.name === 'string' && existing.name) || scene.state.uid || 'new-dashboard';
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- assemble the metadata envelope
  return {
    ...existing,
    name,
    generation: typeof existing.generation === 'number' ? existing.generation : 1,
    creationTimestamp:
      typeof existing.creationTimestamp === 'string' ? existing.creationTimestamp : new Date().toISOString(),
  } as EnvelopeMetadata;
}

// Read as-is: an unset flag stays unset rather than being coerced to `true`. This DTO is internal
// plumbing fed into transformSaveModelSchemaV2ToScene -- neither caller exposes it directly to a
// human or an assistant, so there's no reason for one side to see synthesized permissions the
// scene never actually granted.
function resolveAccess(scene: DashboardScene): EnvelopeAccess {
  const meta = scene.state.meta;
  return {
    canEdit: meta.canEdit,
    canSave: meta.canSave,
    canShare: meta.canShare,
    canStar: meta.canStar,
    canDelete: meta.canDelete,
    canAdmin: meta.canAdmin,
    annotationsPermissions: meta.annotationsPermissions,
    slug: meta.slug,
    url: meta.url,
  };
}

// Always the full "group/version" string -- the format the real k8s TypeMeta.apiVersion carries
// on the wire, and what ShareSnapshotTab's `apiVersion?.startsWith('dashboard.grafana.app/v2')`
// check requires downstream. (Previously APPLY_SPEC stamped a bare version here, which broke that
// check for any dashboard rebuilt through it -- fixed by unifying on this shared resolver.)
function resolveApiVersion(): string {
  return `${DASHBOARD_API_GROUP}/${dashboardAPIVersionResolver.getV2()}`;
}

export function buildDashboardWithAccessInfoFromScene(
  scene: DashboardScene,
  spec: DashboardV2Spec,
  options: BuildDashboardWithAccessInfoOptions
): DashboardWithAccessInfo<DashboardV2Spec> {
  return {
    kind: 'DashboardWithAccessInfo',
    metadata: resolveMetadata(scene, options.metadataFields),
    access: resolveAccess(scene),
    apiVersion: resolveApiVersion(),
    spec,
  };
}
