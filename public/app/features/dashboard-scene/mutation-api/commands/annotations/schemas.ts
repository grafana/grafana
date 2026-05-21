/**
 * Annotation-entity Zod schemas and command payload schemas.
 *
 */

import { z } from 'zod';

import {
  AnnotationEventFieldMappingSchema,
  AnnotationPanelFilterSchema,
  AnnotationQueryKindSchema,
  AnnotationQuerySpecSchema,
} from '@grafana/schema/apis/dashboard.grafana.app/v2/zod';

import { dataQueryKindSchema as sharedDataQueryKindSchema, emptyPayloadSchema } from '../schemas';
import { stripDefaults } from '../stripDefaults';

// ----- Building blocks ------------------------------------------------------

export const annotationQueryKindSchema = AnnotationQueryKindSchema;
export const annotationQuerySpecSchema = AnnotationQuerySpecSchema;
export const annotationPanelFilterSchema = AnnotationPanelFilterSchema;
export const annotationEventFieldMappingSchema = AnnotationEventFieldMappingSchema;

export const annotationNameSchema = AnnotationQuerySpecSchema.shape.name;

/**
 * Re-export of the shared `dataQueryKindSchema` building block (also used by
 * panel queries and query-variables). Re-exported here so annotation-local
 * code only imports schemas from this file.
 */
export const dataQueryKindSchema = sharedDataQueryKindSchema;

// ----- Payload schemas ------------------------------------------------------

const partialAnnotationQueryKindSchema = annotationQueryKindSchema.extend({
  spec: stripDefaults(annotationQuerySpecSchema)
    .partial()
    .extend({
      filter: stripDefaults(annotationPanelFilterSchema).partial().optional(),
      mappings: z.record(z.string(), stripDefaults(annotationEventFieldMappingSchema).partial()).optional(),
      query: stripDefaults(dataQueryKindSchema)
        .partial()
        .optional()
        .describe('Partial query update; deep-merged into existing query.'),
    })
    .describe('Fields to update (partial AnnotationQuerySpec). Omitted fields are left unchanged.'),
});

export const addAnnotationPayloadSchema = z.object({
  annotation: annotationQueryKindSchema,
  position: z.number().optional().describe('Position in annotations list (optional, appends if not set)'),
});

export const updateAnnotationPayloadSchema = z.object({
  name: annotationNameSchema.describe('Annotation name to update'),
  annotation: partialAnnotationQueryKindSchema.describe(
    'Partial annotation update. Only provided fields are applied. Object fields are deep-merged. ' +
      'Arrays (e.g. filter.ids) are replaced wholesale.'
  ),
});

export const removeAnnotationPayloadSchema = z.object({
  name: annotationNameSchema.describe('Annotation name to remove'),
});

export const payloads = {
  addAnnotation: addAnnotationPayloadSchema.describe('Add a new dashboard annotation'),
  updateAnnotation: updateAnnotationPayloadSchema.describe(
    'Update an existing dashboard annotation by name (partial update, deep-merge)'
  ),
  removeAnnotation: removeAnnotationPayloadSchema.describe('Remove a dashboard annotation by name'),
  listAnnotations: emptyPayloadSchema.describe('List all annotations on the dashboard'),
};
