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

import z from 'zod';

import { t } from '@grafana/i18n';

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * UserStorage key for Alert Rules page saved searches.
 */
export const RULES_SAVED_SEARCHES_STORAGE_KEY = 'savedSearches';

/**
 * UserStorage key for Alert Activity (Triage) page saved searches.
 */
export const TRIAGE_SAVED_SEARCHES_STORAGE_KEY = 'triageSavedSearches';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Zod schema for validating a saved search object.
 * Used to validate data loaded from storage.
 */
export const savedSearchSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  query: z.string(),
  createdAt: z.number().optional(),
});

/**
 * Zod schema for validating an array of saved searches.
 */
export const savedSearchesArraySchema = z.array(savedSearchSchema);

// ============================================================================
// Types
// ============================================================================

export type SavedSearch = z.infer<typeof savedSearchSchema>;

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

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates a saved search name.
 * @param name - The name to validate
 * @param savedSearches - Existing saved searches for uniqueness check
 * @param excludeId - Optional ID to exclude from uniqueness check (for rename)
 * @returns Error message string or null if valid
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
