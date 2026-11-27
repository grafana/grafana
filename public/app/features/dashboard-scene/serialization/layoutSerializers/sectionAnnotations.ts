import { uniqueId } from 'lodash';

import { type SceneObject } from '@grafana/scenes';
import { type AnnotationQueryKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { transformV2ToV1AnnotationQuery } from '../annotations';
import { annotationLayersToSchemaV2 } from '../transformSceneToSaveModelSchemaV2';

export function annotationQueryKindToLayer(annotation: AnnotationQueryKind): DashboardAnnotationsDataLayer {
  return new DashboardAnnotationsDataLayer({
    key: uniqueId('annotations-'),
    query: transformV2ToV1AnnotationQuery(annotation),
    name: annotation.spec.name,
    isEnabled: Boolean(annotation.spec.enable),
    isHidden: Boolean(annotation.spec.hide),
    placement: annotation.spec.placement,
  });
}

export function serializeSectionAnnotations(data?: SceneObject): AnnotationQueryKind[] | undefined {
  if (!(data instanceof DashboardDataLayerSet)) {
    return undefined;
  }

  const annotations = annotationLayersToSchemaV2(data.state.annotationLayers);
  return annotations.length > 0 ? annotations : undefined;
}

export function deserializeSectionAnnotations(
  annotations?: AnnotationQueryKind[],
  isSnapshot?: boolean
): DashboardDataLayerSet | undefined {
  // Snapshots embed annotation results in panel data. Live section layers would query again.
  if (isSnapshot || !annotations || annotations.length === 0) {
    return undefined;
  }

  return new DashboardDataLayerSet({
    annotationLayers: annotations.map((annotation) => annotationQueryKindToLayer(annotation)),
  });
}
