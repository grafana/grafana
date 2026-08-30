import fs from 'fs';
import path from 'path';

import { type Variant } from './variants.ts';

/** List JSON files in the appropriate openapi_snapshots directory. */
export function getOpenAPISpecs(basePath: string, variant: Variant): string[] {
  const openapiDir = path.join(basePath, variant.openapiSnapshots);

  try {
    return fs.readdirSync(openapiDir).filter((file) => file.endsWith('.json'));
  } catch {
    throw new Error(
      "No OpenAPI specs found! Are you trying to generate an API client for enterprise but haven't linked your local environment?"
    );
  }
}
