/**
 * REMOVE_ANNOTATION command
 *
 * Remove a dashboard annotation layer by name. Built-in Grafana annotations
 * cannot be removed (they are auto-injected on dashboard load).
 */

import { type z } from 'zod';

import {
  findAnnotationLayer,
  getAnnotationLayerSet,
  isBuiltInAnnotation,
  replaceAnnotationLayers,
} from './annotationUtils';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const removeAnnotationPayloadSchema = payloads.removeAnnotation;

export type RemoveAnnotationPayload = z.infer<typeof removeAnnotationPayloadSchema>;

export const removeAnnotationCommand: MutationCommand<RemoveAnnotationPayload> = {
  name: 'REMOVE_ANNOTATION',
  description: payloads.removeAnnotation.description ?? '',

  payloadSchema: payloads.removeAnnotation,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { name } = payload;
      const set = getAnnotationLayerSet(scene);
      const found = findAnnotationLayer(set, name);
      if (!found) {
        throw new Error(`Annotation '${name}' not found`);
      }

      if (isBuiltInAnnotation(found.layer)) {
        throw new Error(`Cannot remove the built-in Grafana annotation layer`);
      }

      const previousState = found.layer.state;
      const updated = set.state.annotationLayers.filter((_, idx) => idx !== found.index);
      replaceAnnotationLayers(set, updated);

      return {
        success: true,
        data: { name },
        changes: [{ path: `/annotations/${name}`, previousValue: previousState, newValue: null }],
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
