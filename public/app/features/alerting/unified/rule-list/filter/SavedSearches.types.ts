/**
 * Shared types and utilities for SavedSearches feature.
 *
 * This module is extracted to avoid circular dependencies between:
 * - SavedSearches.tsx (main component)
 * - InlineSaveInput.tsx, InlineRenameInput.tsx, SavedSearchItem.tsx (sub-components)
 * - useSavedSearches.ts (hook)
 */

import z from 'zod';

import { t } from '@grafana/i18n';

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
