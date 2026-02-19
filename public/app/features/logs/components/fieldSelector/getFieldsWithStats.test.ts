import { createDataFrame, FieldType } from '@grafana/data';

import { getFieldsWithStats } from './getFieldsWithStats';

describe('getFieldsWithStats', () => {
  it('should include severity field (level) in available fields', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'message', type: FieldType.string, values: ['Info line', 'Warn line', 'Error line'] },
        { name: 'level', type: FieldType.string, values: ['info', 'warn', 'error'] },
        { name: '_id', type: FieldType.string, values: ['1', '2', '3'] },
      ],
    });

    const result = getFieldsWithStats([frame]);

    const fieldNames = result.map((f) => f.name);
    expect(fieldNames).toContain('level');
    expect(result.find((f) => f.name === 'level')?.stats.percentOfLinesWithLabel).toBe(100);
  });

  it('should include detected_level when used as severity field', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'message', type: FieldType.string, values: ['line1', 'line2'] },
        { name: 'detected_level', type: FieldType.string, values: ['info', 'error'] },
      ],
    });

    const result = getFieldsWithStats([frame]);

    const fieldNames = result.map((f) => f.name);
    expect(fieldNames).toContain('detected_level');
  });

  it('should include extraFields and severity field', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'message', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'level', type: FieldType.string, values: ['info', 'warn', 'error'] },
        { name: 'hostname', type: FieldType.string, values: ['h1', 'h2', 'h3'] },
      ],
    });

    const result = getFieldsWithStats([frame]);

    const fieldNames = result.map((f) => f.name);
    expect(fieldNames).toContain('level');
    expect(fieldNames).toContain('hostname');
  });
});
