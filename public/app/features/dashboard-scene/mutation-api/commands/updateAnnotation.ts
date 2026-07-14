/**
 * UPDATE_ANNOTATION command
 *
 * Partial update of an existing dashboard annotation layer. Only the fields
 * provided in `annotation.spec` are applied; everything else on the layer is
 * preserved. Object fields are deep-merged; arrays (e.g. `filter.ids`) are
 * replaced wholesale to match `UPDATE_PANEL` semantics.
 */

import { cloneDeep, isArray, mergeWith } from 'lodash';
import { type z } from 'zod';

import { type AnnotationQueryKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import {
  annotationLayerToKind,
  buildAnnotationLayer,
  findAnnotationLayer,
  getAnnotationLayerSet,
  replaceAnnotationLayers,
} from './annotationUtils';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

type UpdateAnnotationPayload = z.infer<typeof payloads.updateAnnotation>;

// Mirrors the helper inlined in updatePanel.ts. Kept local here to avoid touching
// already-shipped panel code; share via a common util once both PRs land.
function mergeReplacingArrays(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  return mergeWith(cloneDeep(target), source, (_objValue: unknown, srcValue: unknown) => {
    if (isArray(srcValue)) {
      return srcValue;
    }
    return undefined;
  });
}

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
      const set = getAnnotationLayerSet(scene);

      const found = findAnnotationLayer(set, name);
      if (!found) {
        throw new Error(`Annotation '${name}' not found`);
      }

      const existingKind = annotationLayerToKind(found.layer);
      if (!existingKind) {
        throw new Error(`Annotation '${name}' could not be read for partial update`);
      }

      const newName = payload.annotation.spec?.name;
      if (newName !== undefined && newName !== name && findAnnotationLayer(set, newName)) {
        throw new Error(`Annotation '${newName}' already exists`);
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mergeReplacingArrays is structurally typed; cast both sides through Record for the helper and back to the kind shape.
      const existingAsRecord = existingKind as unknown as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial Zod output is structurally a Record subset of AnnotationQueryKind.
      const partialAsRecord = payload.annotation as Record<string, unknown>;
      const mergedRecord = mergeReplacingArrays(existingAsRecord, partialAsRecord);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- merge result is structurally an AnnotationQueryKind because both inputs were.
      const merged = mergedRecord as unknown as AnnotationQueryKind;

      const previousState = found.layer.state;
      const newLayer = buildAnnotationLayer(merged);
      const updated = [...set.state.annotationLayers];
      updated[found.index] = newLayer;
      replaceAnnotationLayers(set, updated);

      return {
        success: true,
        data: { name: merged.spec.name },
        changes: [
          {
            path: `/annotations/${name}`,
            previousValue: previousState,
            newValue: merged.spec.name,
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
