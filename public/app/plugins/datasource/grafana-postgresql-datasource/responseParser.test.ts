import { FieldType, DataFrame } from '@grafana/data';

import { transformMetricFindResponse } from './responseParser';

describe('transformMetricFindResponse function', () => {
  it('should handle big arrays', () => {
    const stringValues = new Array(150_000).fill('a');
    const numberValues = new Array(150_000).fill(1);

    const frame: DataFrame = {
      fields: [
        { name: 'name', type: FieldType.string, config: {}, values: stringValues },
        { name: 'value', type: FieldType.number, config: {}, values: numberValues },
      ],
      length: stringValues.length,
    };

    const result = transformMetricFindResponse(frame);

    // All values from both fields are added with properties from the same row
    // 150,000 'a' values from 'name' field + 150,000 '1' values from 'value' field = 300,000 total
    // After deduplication by text, we get 2 unique items ('a' and '1')
    expect(result).toHaveLength(2);

    const textValues = result.map((r) => r.text);
    expect(textValues).toContain('a');
    expect(textValues).toContain('1'); // Numbers are converted to strings

    // Check that properties are included
    const aEntry = result.find((r) => r.text === 'a');
    expect(aEntry?.properties).toBeDefined();
  });

  it('should add all values from multiple fields with properties from same row', () => {
    const frame: DataFrame = {
      fields: [
        { name: 'id', type: FieldType.string, config: {}, values: ['user1', 'user2', 'user3'] },
        {
          name: 'email',
          type: FieldType.string,
          config: {},
          values: ['user1@test.com', 'user2@test.com', 'user3@test.com'],
        },
        { name: 'role', type: FieldType.string, config: {}, values: ['admin', 'user', 'guest'] },
      ],
      length: 3,
    };

    const result = transformMetricFindResponse(frame);

    // All values from all fields are added (3 rows × 3 fields = 9 entries)
    expect(result).toHaveLength(9);

    // Value from row 0 of id field gets properties from row 0 of other fields
    const user1Entry = result.find((r) => r.text === 'user1');
    expect(user1Entry).toBeDefined();
    expect(user1Entry?.properties).toBeDefined();
    expect(user1Entry?.properties?.email).toBe('user1@test.com');
    expect(user1Entry?.properties?.role).toBe('admin');

    // Value from row 1 of email field gets properties from row 1 of other fields
    const user2EmailEntry = result.find((r) => r.text === 'user2@test.com');
    expect(user2EmailEntry).toBeDefined();
    expect(user2EmailEntry?.properties).toBeDefined();
    expect(user2EmailEntry?.properties?.id).toBe('user2');
    expect(user2EmailEntry?.properties?.role).toBe('user');
  });

  it('should handle single field', () => {
    const frame: DataFrame = {
      fields: [{ name: 'name', type: FieldType.string, config: {}, values: ['value1', 'value2'] }],
      length: 2,
    };

    const result = transformMetricFindResponse(frame);

    expect(result).toHaveLength(2);
    // With single field, properties include the same field
    expect(result[0]).toEqual({
      text: 'value1',
      properties: {
        name: 'value1',
      },
    });
    expect(result[1]).toEqual({
      text: 'value2',
      properties: {
        name: 'value2',
      },
    });
  });

  it('should still handle __text and __value fields', () => {
    const frame: DataFrame = {
      fields: [
        { name: '__text', type: FieldType.string, config: {}, values: ['Display 1', 'Display 2'] },
        { name: '__value', type: FieldType.string, config: {}, values: ['val1', 'val2'] },
      ],
      length: 2,
    };

    const result = transformMetricFindResponse(frame);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      text: 'Display 1',
      value: 'val1',
    });
    expect(result[1]).toEqual({
      text: 'Display 2',
      value: 'val2',
    });
  });

  it('should skip fields named "text" or "value" in properties', () => {
    const frame: DataFrame = {
      fields: [
        { name: 'id', type: FieldType.string, config: {}, values: ['item1', 'item2'] },
        { name: 'text', type: FieldType.string, config: {}, values: ['Text 1', 'Text 2'] },
        { name: 'value', type: FieldType.string, config: {}, values: ['Value 1', 'Value 2'] },
        { name: 'description', type: FieldType.string, config: {}, values: ['Desc 1', 'Desc 2'] },
      ],
      length: 2,
    };

    const result = transformMetricFindResponse(frame);

    // All values from all fields are added (2 values × 4 fields = 8 entries)
    expect(result).toHaveLength(8);

    // Check that 'text' and 'value' fields are not in properties
    const item1Entry = result.find((r) => r.text === 'item1');
    expect(item1Entry?.properties).toBeDefined();
    expect(item1Entry?.properties).not.toHaveProperty('text');
    expect(item1Entry?.properties).not.toHaveProperty('value');
    expect(item1Entry?.properties?.description).toBe('Desc 1');
  });

  it('should add additional fields as properties when __text and __value are present', () => {
    const frame: DataFrame = {
      fields: [
        { name: '__text', type: FieldType.string, config: {}, values: ['Display 1', 'Display 2'] },
        { name: '__value', type: FieldType.string, config: {}, values: ['val1', 'val2'] },
        { name: 'category', type: FieldType.string, config: {}, values: ['cat1', 'cat2'] },
        { name: 'priority', type: FieldType.number, config: {}, values: [1, 2] },
      ],
      length: 2,
    };

    const result = transformMetricFindResponse(frame);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      text: 'Display 1',
      value: 'val1',
      properties: {
        category: 'cat1',
        priority: '1',
      },
    });
    expect(result[1]).toEqual({
      text: 'Display 2',
      value: 'val2',
      properties: {
        category: 'cat2',
        priority: '2',
      },
    });
  });
});
