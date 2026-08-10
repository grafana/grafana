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
import { djb2Hash } from '../utils/djb2Hash';

/** Returned when expectedRevision no longer matches the live scene. */
export const REVISION_MISMATCH = 'REVISION_MISMATCH';

/**
 * Hash of a spec already produced by transformSceneToSaveModelSchemaV2.
 *
 * Length is part of the token so a djb2 collision only goes undetected if the
 * two specs also serialize to the same number of characters.
 */
export function computeRevisionToken(spec: DashboardV2Spec): string {
  const json = JSON.stringify(spec);
  return `${djb2Hash(json).toString(16)}-${json.length.toString(16)}`;
}

/** Hash of the live scene. Throws if the scene cannot serialize. */
export function getDashboardRevision(scene: DashboardScene): string {
  return computeRevisionToken(transformSceneToSaveModelSchemaV2(scene));
}
