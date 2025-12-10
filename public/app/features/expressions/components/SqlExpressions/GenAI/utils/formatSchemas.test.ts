import { SQLSchemasResponse } from '../../hooks/useSQLSchemas';

import { formatSchemasForPrompt } from './formatSchemas';

describe('formatSchemasForPrompt', () => {
  const createSchemaResponse = (sqlSchemas: SQLSchemasResponse['sqlSchemas']): SQLSchemasResponse => ({
    kind: 'SQLSchemaResponse',
    apiVersion: 'query.grafana.app/v0alpha1',
    sqlSchemas,
  });

  it('returns fallback message for null/undefined/empty schemas', () => {
    expect(formatSchemasForPrompt(null)).toBe('No schema information available.');
    expect(formatSchemasForPrompt(undefined)).toBe('No schema information available.');
    expect(formatSchemasForPrompt(createSchemaResponse({}))).toBe('No schema information available.');
  });

  it('includes schema errors instead of silently failing', () => {
    const schemas = createSchemaResponse({
      A: {
        columns: null,
        sampleRows: null,
        error: 'Connection timeout',
      },
    });

    const result = formatSchemasForPrompt(schemas);

    expect(result).toBe('RefID A: Error - Connection timeout');
  });

  it('truncates columns beyond default limit to prevent token overflow', () => {
    const maxColumns = 10; // Default limit
    const totalColumns = 15;
    const columns = Array.from({ length: totalColumns }, (_, i) => ({
      name: `column_${i + 1}`,
      mysqlType: 'VARCHAR',
      dataFrameFieldType: 'string',
      nullable: false,
    }));

    const schemas = createSchemaResponse({
      A: {
        columns,
        sampleRows: null,
        error: undefined,
      },
    });

    const result = formatSchemasForPrompt(schemas);

    // Should include columns up to limit
    expect(result).toContain('column_1 (VARCHAR, not null)');
    expect(result).toContain(`column_${maxColumns} (VARCHAR, not null)`);

    // Should truncate columns beyond limit
    expect(result).not.toContain(`column_${maxColumns + 1}`);
    expect(result).toContain(`... and ${totalColumns - maxColumns} more columns`);
  });

  it('formats multiple RefIDs with proper separation', () => {
    const schemas = createSchemaResponse({
      A: {
        columns: [{ name: 'time', mysqlType: 'TIMESTAMP', dataFrameFieldType: 'time', nullable: false }],
        sampleRows: [[1234567890]],
        error: undefined,
      },
      B: {
        columns: [{ name: 'value', mysqlType: 'FLOAT', dataFrameFieldType: 'number', nullable: true }],
        sampleRows: [[42.5]],
        error: undefined,
      },
      C: {
        columns: [{ name: 'label', mysqlType: 'VARCHAR', dataFrameFieldType: 'string', nullable: false }],
        sampleRows: [['production']],
        error: undefined,
      },
    });

    const result = formatSchemasForPrompt(schemas);

    expect(result).toContain('RefID A:');
    expect(result).toContain('time (TIMESTAMP, not null)');
    expect(result).toContain('RefID B:');
    expect(result).toContain('value (FLOAT, nullable)');
    expect(result).toContain('RefID C:');
    expect(result).toContain('label (VARCHAR, not null)');
    expect(result.split('\n\n').length).toBe(3);
  });
});
