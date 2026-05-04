/**
 * UPDATE_ANNOTATION command
 *
 * Replace an existing dashboard annotation layer with a new definition,
 * preserving its position in the annotations list.
 */

import { type z } from 'zod';

import { type AnnotationQueryKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  buildAnnotationLayer,
  findAnnotationLayer,
  getAnnotationLayerSet,
  replaceAnnotationLayers,
} from './annotationUtils';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

type UpdateAnnotationPayload = z.infer<typeof payloads.updateAnnotation>;

export const updateAnnotationCommand: MutationCommand<UpdateAnnotationPayload> = {
  name: 'UPDATE_ANNOTATION',
  description: payloads.updateAnnotation.description ?? '',

  payloadSchema: payloads.updateAnnotation,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { name } = payload;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with AnnotationQueryKind
      const annotation = payload.annotation as AnnotationQueryKind;
      const set = getAnnotationLayerSet(scene);

      const found = findAnnotationLayer(set, name);
      if (!found) {
        throw new Error(`Annotation '${name}' not found`);
      }

      const previousState = found.layer.state;
      const newLayer = buildAnnotationLayer(annotation);
      const updated = [...set.state.annotationLayers];
      updated[found.index] = newLayer;
      replaceAnnotationLayers(set, updated);

      return {
        success: true,
        data: { name: annotation.spec.name },
        changes: [
          {
            path: `/annotations/${name}`,
            previousValue: previousState,
            newValue: annotation.spec.name,
          },
        ],
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
