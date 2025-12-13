import { SQLSchemasResponse, SQLSchemaField } from '../../hooks/useSQLSchemas';

const DEFAULT_MAX_COLUMNS = 10;

/**
 * Format schemas into a readable string for LLM context with token budget management
 *
 * This function converts SQL schema information into a human-readable format suitable
 * for LLM prompts. It includes column names, types, nullability, and sample data.
 *
 * Token budget management:
 * - Limits columns per RefID to prevent excessive token usage
 * - Respects original column order from schema
 * - Provides summary for truncated columns
 *
 * @param schemas - The SQL schemas response from the API
 * @param maxColumnsPerRefId - Maximum number of columns to include per RefID (default: 10)
 * @returns A formatted string representation of the schemas
 */
export const formatSchemasForPrompt = (
  schemas?: SQLSchemasResponse | null,
  maxColumnsPerRefId = DEFAULT_MAX_COLUMNS
): string => {
  if (!schemas?.sqlSchemas || Object.keys(schemas.sqlSchemas).length === 0) {
    return 'No schema information available.';
  }

  const schemaParts: string[] = [];

  for (const [refId, schemaData] of Object.entries(schemas.sqlSchemas)) {
    if (schemaData.error) {
      schemaParts.push(`RefID ${refId}: Error - ${schemaData.error}`);
      continue;
    }

    if (!schemaData.columns || schemaData.columns.length === 0) {
      schemaParts.push(`RefID ${refId}: No columns available`);
      continue;
    }

    const columnsToShow = schemaData.columns.slice(0, maxColumnsPerRefId);
    const remainingCount = schemaData.columns.length - columnsToShow.length;

    const columnDescriptions = columnsToShow.map(({ nullable, name, mysqlType }: SQLSchemaField) => {
      const isNullable = nullable ? 'nullable' : 'not null';
      return `  - ${name} (${mysqlType}, ${isNullable})`;
    });

    // Add truncation notice if we hit the limit
    if (remainingCount > 0) {
      columnDescriptions.push(`  ... and ${remainingCount} more column${remainingCount > 1 ? 's' : ''}`);
    }

    // Build schema text parts
    const textParts = [`RefID ${refId}:`, columnDescriptions.join('\n')];

    // Add sample data if available (first row only)
    if (schemaData.sampleRows && schemaData.sampleRows.length > 0) {
      const sampleRow = schemaData.sampleRows[0];
      const sampleValues = columnsToShow
        .map(({ name }: SQLSchemaField, idx: number) => `${name}=${JSON.stringify(sampleRow[idx])}`)
        .join(', ');
      textParts.push(`  Sample: ${sampleValues}`);
    }

    schemaParts.push(textParts.join('\n'));
  }

  return schemaParts.join('\n\n');
};
