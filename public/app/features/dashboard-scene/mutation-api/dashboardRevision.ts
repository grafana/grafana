/**
 * Dashboard revision tokens for APPLY_SPEC compare-and-swap.
 *
 * Opaque content hash of the v2 save model (not a scene event counter — those
 * fire for no-op state changes). Callers pass a prior token as expectedRevision;
 * mismatch → REVISION_MISMATCH instead of overwriting concurrent UI edits.
 */

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import type { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

/** Returned when expectedRevision no longer matches the live scene. */
export const REVISION_MISMATCH = 'REVISION_MISMATCH';

/** FNV-1a, two 32-bit lanes → 64-bit hex token. */
function hashString(value: string): string {
  let low = 0x811c9dc5;
  let high = 0x01000193;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    low = Math.imul(low ^ code, 0x01000193);
    high = Math.imul(high ^ code, 0x85ebca6b);
  }
  return (low >>> 0).toString(16).padStart(8, '0') + (high >>> 0).toString(16).padStart(8, '0');
}

/** Hash of a spec already produced by transformSceneToSaveModelSchemaV2. */
export function computeRevisionToken(spec: DashboardV2Spec): string {
  return hashString(JSON.stringify(spec));
}

/** Hash of the live scene. Throws if the scene cannot serialize. */
export function getDashboardRevision(scene: DashboardScene): string {
  return computeRevisionToken(transformSceneToSaveModelSchemaV2(scene));
}
