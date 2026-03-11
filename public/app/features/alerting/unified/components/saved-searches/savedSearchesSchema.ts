/**
 * Shared types and utilities for SavedSearches feature.
 *
 * This module provides a common schema used by multiple pages:
 * - Alert Rules page (storage key: 'savedSearches')
 * - Alert Activity/Triage page (storage key: 'triageSavedSearches')
 *
 * Each page stores its saved searches separately using different UserStorage keys,
 * but shares the same schema structure. The `query` field is generic and stores
 * page-specific serialized state:
 * - Alert Rules: Search query string (e.g., "state:firing namespace:global")
 * - Alert Activity: URL parameters (e.g., "var-filters=...&var-groupBy=...&from=...&to=...")
 */

import {
  type InferOutput,
  array,
  object,
  optional,
  boolean as vBoolean,
  number as vNumber,
  string as vString,
} from 'valibot';

import { t } from '@grafana/i18n';

/**
 * Valibot schema for validating a saved search object.
 * Used to validate data loaded from storage.
 */
export const savedSearchSchema = object({
  id: vString(),
  name: vString(),
  isDefault: vBoolean(),
  query: vString(),
  createdAt: optional(vNumber()),
});
export const savedSearchesArraySchema = array(savedSearchSchema);

export type SavedSearch = InferOutput<typeof savedSearchSchema>;

export interface ValidationError {
  field: 'name';
  message: string;
}

/**
 * Type guard to check if an error is a ValidationError.
 */
export function isValidationError(error: unknown): error is ValidationError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'field' in error &&
      'message' in error &&
      error.field === 'name' &&
      typeof error.message === 'string'
  );
}

/**
 * Validates a saved search name.
 */
export function validateSearchName(name: string, savedSearches: SavedSearch[], excludeId?: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return t('alerting.saved-searches.error-name-required', 'Name is required');
  }

  const isDuplicate = savedSearches.some(
    (s) => (excludeId ? s.id !== excludeId : true) && s.name.toLowerCase() === trimmed.toLowerCase()
  );

  if (isDuplicate) {
    return t('alerting.saved-searches.error-name-duplicate', 'A saved search with this name already exists');
  }

  return null;
}
