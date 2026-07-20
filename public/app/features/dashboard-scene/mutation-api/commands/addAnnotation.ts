/**
 * ADD_ANNOTATION command
 *
 * Add a dashboard annotation layer using v2beta1 AnnotationQueryKind format.
 */

import { type z } from 'zod';

import { type AnnotationQueryKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  buildAnnotationLayer,
  findAnnotationLayer,
  getAnnotationLayerSet,
  hasBuiltInAnnotation,
  replaceAnnotationLayers,
} from './annotationUtils';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

type AddAnnotationPayload = z.infer<typeof payloads.addAnnotation>;

export const addAnnotationCommand: MutationCommand<AddAnnotationPayload> = {
  name: 'ADD_ANNOTATION',
  description: payloads.addAnnotation.description ?? '',

  payloadSchema: payloads.addAnnotation,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with AnnotationQueryKind
      const annotation = payload.annotation as AnnotationQueryKind;
      const name = annotation.spec.name;
      const set = getAnnotationLayerSet(scene);

      if (findAnnotationLayer(set, name)) {
        throw new Error(`Annotation '${name}' already exists`);
      }

      if (annotation.spec.builtIn && hasBuiltInAnnotation(set)) {
        throw new Error('Dashboard already has a built-in annotation layer');
      }

      const newLayer = buildAnnotationLayer(annotation);
      const updated = [...set.state.annotationLayers];
      const { position } = payload;

      if (position !== undefined && position >= 0 && position < updated.length) {
        updated.splice(position, 0, newLayer);
      } else {
        updated.push(newLayer);
      }

      replaceAnnotationLayers(set, updated);

      return {
        success: true,
        data: { name },
        changes: [{ path: `/annotations/${name}`, previousValue: null, newValue: name }],
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
