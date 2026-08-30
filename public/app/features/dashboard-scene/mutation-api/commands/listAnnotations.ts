/**
 * LIST_ANNOTATIONS command
 *
 * List all annotation layers on the current dashboard in v2beta1
 * AnnotationQueryKind format. Returns layers in scene order (built-in first
 * by load convention).
 */

import type { AnnotationQueryKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import type { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';

import { annotationLayerToKind } from './annotationUtils';
import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const listAnnotationsCommand: MutationCommand<Record<string, never>> = {
  name: 'LIST_ANNOTATIONS',
  description: payloads.listAnnotations.description ?? '',

  payloadSchema: payloads.listAnnotations,
  permission: readOnly,
  readOnly: true,

  handler: async (_payload, context) => {
    const { scene } = context;

    try {
      let set: DashboardDataLayerSet;
      try {
        set = dashboardSceneGraph.getDataLayers(scene);
      } catch {
        return { success: true, data: { annotations: [] }, changes: [] };
      }

      const annotations: AnnotationQueryKind[] = [];
      for (const layer of set.state.annotationLayers) {
        const kind = annotationLayerToKind(layer);
        if (kind) {
          annotations.push(kind);
        }
      }

      return {
        success: true,
        data: { annotations },
        changes: [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
