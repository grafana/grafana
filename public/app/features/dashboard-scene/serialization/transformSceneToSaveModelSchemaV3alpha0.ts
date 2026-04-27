import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as DashboardV3alpha0Spec } from '@grafana/schema/apis/dashboard.grafana.app/v3alpha0';

import { type DashboardScene } from '../scene/DashboardScene';

import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';
import { V3ALPHA0_TRANSFORMATION_WIRE_FORMAT, convertSpecToWireFormat } from './transformationCompat';

/**
 * Transform a DashboardScene into a v3alpha0 DashboardSpec.
 *
 * v3alpha0 shares the v2 body (layout, panels, variables, annotations) but
 * diverges on two axes:
 *  - transformations use the v2beta1 wire shape ({ kind: <id>, spec: { id, ... } })
 *  - adds optional `rules` plus optional `name` on rows and tabs
 *
 * The scene holds data in v2 stable's internal shape, so we:
 *  1. Run the v2 transform to produce a v2-typed spec.
 *  2. Pass it through convertSpecToWireFormat forced to v2beta1 to reshape
 *     transformations to the v3alpha0 wire format (v3 and v2beta1 match here).
 *  3. Layer rules on top when the scene carries any.
 *
 * Result is a DashboardV3alpha0Spec ready for the v3alpha0 API client.
 */
export function transformSceneToSaveModelSchemaV3alpha0(
  scene: DashboardScene,
  isSnapshot = false
): DashboardV3alpha0Spec {
  const v2Spec = transformSceneToSaveModelSchemaV2(scene, isSnapshot);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const reshapedSpec = convertSpecToWireFormat(
    v2Spec,
    V3ALPHA0_TRANSFORMATION_WIRE_FORMAT
  ) as unknown as DashboardV3alpha0Spec;

  const rules = scene.state.dashboardRules?.serialize();
  return rules?.length ? { ...reshapedSpec, rules } : reshapedSpec;
}

/**
 * Convert a v3alpha0 spec received from the API back into the scene's internal
 * v2 stable shape. This normalises v3alpha0's v2beta1-style transformations
 * to the v2 stable representation so the scene transform can consume them.
 */
export function v3alpha0WireToV2Internal(spec: DashboardV3alpha0Spec): DashboardV2Spec {
  // v3alpha0 body matches v2beta1 on transformations. The existing v2 transform
  // path normalises these via normalizeTransformation during load; here we pass
  // the spec through without reshaping because downstream code calls the
  // transformationCompat layer on read.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return spec as unknown as DashboardV2Spec;
}
