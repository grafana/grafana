import type { Operation } from 'fast-json-patch';

/**
 * A single patch configuration for an OpenAPI schema
 */
export interface SchemaPatch {
  operations: Operation[];
  /** Optional description for documentation */
  description?: string;
}

export interface SpecPatches {
  [filename: string]: SchemaPatch[];
}
