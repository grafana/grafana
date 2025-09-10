import type { Operation } from 'fast-json-patch';

/**
 * Type definitions for OpenAPI spec patches
 */

/**
 * A single patch configuration for an OpenAPI schema
 */
export interface SchemaPatch {
  /** JSON Patch operations to apply */
  operations: Operation[];
  /** Optional description for documentation */
  description?: string;
}

/**
 * Collection of patches organized by spec filename
 */
export interface SpecPatches {
  [filename: string]: SchemaPatch[];
}
