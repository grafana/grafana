import { z } from 'zod';

export const KindSchema = <K extends string, S extends z.ZodTypeAny>(
  kind: K,
  specSchema: S
  // metadataSchema: M = z.ZodObject<{}> as M
) =>
  z.object({
    kind: z.literal(kind),
    spec: specSchema,
    // metadata: metadataSchema.optional(),
  });
