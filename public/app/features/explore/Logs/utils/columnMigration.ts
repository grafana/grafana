import { LOG_LINE_BODY_FIELD_NAME, TABLE_LINE_FIELD_NAME } from 'app/features/logs/components/LogDetailsBody';

/**
 * Migration utility for converting legacy 'columns' URL parameter to 'displayedFields'.
 */

/**
 * Parses legacy columns value from URL.
 * Handles both array format and object format (e.g., {0: 'Time', 1: 'Line'}).
 *
 * @param columnsValue - The raw columns value from URL state
 * @returns Array of column names, or null if invalid/empty
 */
export function parseLegacyColumns(columnsValue: unknown): string[] | null {
  if (columnsValue === null || columnsValue === undefined) {
    return null;
  }

  // Handle array format
  if (Array.isArray(columnsValue)) {
    if (columnsValue.length === 0) {
      return null;
    }
    // Validate all elements are strings
    if (columnsValue.every((v) => typeof v === 'string')) {
      return columnsValue;
    }
    return null;
  }

  // Handle object format (e.g., {0: 'Time', 1: 'Line'})
  if (typeof columnsValue === 'object') {
    const values = Object.values(columnsValue);
    if (values.length === 0) {
      return null;
    }
    // Validate all values are strings and filter to string array
    if (values.every((v): v is string => typeof v === 'string')) {
      return values;
    }
  }

  return null;
}

/**
 * Maps legacy field names to their new equivalents.
 * Currently maps 'Line' to the LOG_LINE_BODY_FIELD_NAME constant.
 *
 * @param columns - Array of column names
 * @returns Array with mapped column names
 */
export function mapLegacyFieldNames(columns: string[]): string[] {
  return columns.map((column) => {
    // Map 'Line' to LOG_LINE_BODY_FIELD_NAME (typically 'body')
    if (column === TABLE_LINE_FIELD_NAME) {
      return LOG_LINE_BODY_FIELD_NAME;
    }
    return column;
  });
}

/**
 * Merges migrated columns with default displayed fields.
 * Default fields come first, then migrated columns (avoiding duplicates).
 *
 * @param migratedColumns - Columns from the legacy format (already mapped)
 * @param defaultFields - Default fields to display
 * @returns Merged array with defaults first, no duplicates
 */
export function mergeWithDefaults(migratedColumns: string[], defaultFields: string[]): string[] {
  const mergedFields = [...defaultFields];

  migratedColumns.forEach((column) => {
    if (!mergedFields.includes(column)) {
      mergedFields.push(column);
    }
  });

  return mergedFields;
}

/**
 * Checks if a logs state object contains legacy columns that need migration.
 * Acts as a type guard to narrow the type to an object with columns property.
 *
 * @param logsState - The logs panel state from URL
 * @returns True if legacy columns exist
 */
export function hasLegacyColumns(logsState: unknown): logsState is object & { columns: unknown } {
  if (!logsState || typeof logsState !== 'object') {
    return false;
  }
  return 'columns' in logsState;
}

/**
 * Extracts the columns value from logs state using safe property access.
 *
 * @param logsState - The logs panel state from URL
 * @returns The columns value, or undefined if not present
 */
export function extractColumnsValue(logsState: object): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(logsState, 'columns');
  return descriptor?.value;
}

/**
 * Main migration function - orchestrates the full migration process.
 * Returns the migrated and merged fields, or null if no migration is needed.
 *
 * @param logsState - The logs panel state from URL
 * @param defaultDisplayedFields - Default fields to merge with
 * @returns Merged displayed fields array, or null if no migration needed
 */
export function migrateLegacyColumns(logsState: unknown, defaultDisplayedFields: string[]): string[] | null {
  // Check if migration is needed (type guard narrows logsState to object)
  if (!hasLegacyColumns(logsState)) {
    return null;
  }

  // Extract and parse the columns value
  const columnsValue = extractColumnsValue(logsState);
  const parsedColumns = parseLegacyColumns(columnsValue);

  if (!parsedColumns) {
    return null;
  }

  // Map legacy field names to new names
  const mappedColumns = mapLegacyFieldNames(parsedColumns);

  // Merge with defaults
  return mergeWithDefaults(mappedColumns, defaultDisplayedFields);
}
