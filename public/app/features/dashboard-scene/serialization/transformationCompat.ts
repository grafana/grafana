import { type Spec as DashboardV2Spec, type TransformationKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type TransformationKind as V2Beta1TransformationKind } from '@grafana/schema/apis/dashboard.grafana.app/v2beta1';

import { type DashboardV2Version, dashboardAPIVersionResolver } from '../../dashboard/api/DashboardAPIVersionResolver';

/**
 * v3alpha0 dashboards share the v2beta1 transformation wire shape ({ kind: <id>, spec: { id, ... } }).
 * When convertSpecToWireFormat gains a first-class 'v3alpha0' branch, update this constant accordingly.
 */
export const V3ALPHA0_TRANSFORMATION_WIRE_FORMAT: DashboardV2Version = 'v2beta1';

/**
 * Wire transformation is what the API returns — either v2 stable or v2beta1 shape.
 */
type WireTransformation = TransformationKind | V2Beta1TransformationKind;

function isV2Transformation(t: WireTransformation): t is TransformationKind {
  return t.kind === 'Transformation' && 'group' in t;
}

/**
 * normalizeTransformation converts a wire-format transformation (either v2 or v2beta1)
 * into the v2 stable internal representation.
 *
 * v2beta1 wire: { kind: "limit",          spec: { id: "limit", disabled, filter, options } }
 * v2 wire:      { kind: "Transformation", group: "limit", spec: { disabled, filter, options } }
 */
export function normalizeTransformation(t: WireTransformation): TransformationKind {
  if (isV2Transformation(t)) {
    return t;
  }

  // v2beta1: kind holds the transformation ID, spec.id is a duplicate
  const { id: _id, ...spec } = t.spec;

  return {
    kind: 'Transformation',
    group: t.kind,
    spec,
  };
}

/**
 * toWireTransformation converts a v2 stable TransformationKind to the wire format
 * expected by the currently resolved API version.
 *
 * When the backend serves v2beta1, we convert back to { kind: <id>, spec: { id: <id>, ... } }.
 * When the backend serves v2, we pass through as-is.
 */
export function toWireTransformation(
  t: TransformationKind,
  version?: DashboardV2Version
): TransformationKind | V2Beta1TransformationKind {
  const resolvedVersion = version ?? dashboardAPIVersionResolver.getV2();

  if (resolvedVersion === 'v2') {
    return t;
  }

  // Convert to v2beta1 wire format
  return {
    kind: t.group,
    spec: {
      id: t.group,
      ...t.spec,
    },
  };
}

/**
 * convertSpecToWireFormat walks a v2 stable DashboardV2Spec and converts all
 * TransformationKind entries to the wire format expected by the resolved API version.
 * Returns a new spec object (does not mutate the input).
 */
export function convertSpecToWireFormat(spec: DashboardV2Spec, version?: DashboardV2Version): DashboardV2Spec {
  const resolvedVersion = version ?? dashboardAPIVersionResolver.getV2();

  // v2 stable — no conversion needed
  if (resolvedVersion === 'v2') {
    return spec;
  }

  // Walk elements and convert transformations to v2beta1 wire format
  const convertedElements: typeof spec.elements = {};
  for (const [key, element] of Object.entries(spec.elements)) {
    if (element.kind === 'Panel' && element.spec.data.spec.transformations.length > 0) {
      // The wire format for v2beta1 is structurally different but gets serialized to JSON,
      // so we build the v2beta1 shape and assign it to the v2-typed field.
      // Normalize first to handle specs that may already be in v2beta1 wire format
      // (e.g. from restoreDashboardVersion), then convert to the target wire format.
      /* eslint-disable @typescript-eslint/consistent-type-assertions */
      const wireTransformations = element.spec.data.spec.transformations.map(
        (t) => toWireTransformation(normalizeTransformation(t), resolvedVersion) as unknown as TransformationKind
      );
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
      convertedElements[key] = {
        ...element,
        spec: {
          ...element.spec,
          data: {
            ...element.spec.data,
            spec: {
              ...element.spec.data.spec,
              transformations: wireTransformations,
            },
          },
        },
      };
    } else {
      convertedElements[key] = element;
    }
  }

  return {
    ...spec,
    elements: convertedElements,
  };
}
