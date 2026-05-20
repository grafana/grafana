import { z } from 'zod';

import { annotationQueryKindSchema } from './schemas';

/**
 * Per-command payload schemas, accessible via DashboardMutationAPI.getPayloadSchema().
 *
 * Each value is a Zod schema with a `.describe()` annotation that serves
 * as the command description (flows into JSON Schema for LLM consumers).
 */
export const addAnnotationPayloadSchema = z.object({
  annotation: annotationQueryKindSchema,
  position: z.number().optional().describe('Position in annotations list (optional, appends if not set)'),
});

export const payloads = {
  addAnnotation: addAnnotationPayloadSchema.describe('Add a new dashboard annotation layer'),
};
