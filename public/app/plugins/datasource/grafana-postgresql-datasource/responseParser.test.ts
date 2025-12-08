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

    // With the new logic, first field is text/value and additional fields are properties
    // After deduplication, we get 1 unique item since all 'a' values deduplicate
    // Fields named 'value' are not added to properties to avoid conflicts
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      text: 'a',
      value: 'a',
    });
  });

  it('should use first field as text and value with additional fields as properties', () => {
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

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      text: 'user1',
      value: 'user1',
      properties: {
        email: 'user1@test.com',
        role: 'admin',
      },
    });
    expect(result[1]).toEqual({
      text: 'user2',
      value: 'user2',
      properties: {
        email: 'user2@test.com',
        role: 'user',
      },
    });
    expect(result[2]).toEqual({
      text: 'user3',
      value: 'user3',
      properties: {
        email: 'user3@test.com',
        role: 'guest',
      },
    });
  });

  it('should handle single field without properties', () => {
    const frame: DataFrame = {
      fields: [{ name: 'name', type: FieldType.string, config: {}, values: ['value1', 'value2'] }],
      length: 2,
    };

    const result = transformMetricFindResponse(frame);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      text: 'value1',
      value: 'value1',
    });
    expect(result[1]).toEqual({
      text: 'value2',
      value: 'value2',
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

  it('should not add fields named "text" or "value" to properties', () => {
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

    expect(result).toHaveLength(2);
    // Fields named 'text' and 'value' should not be in properties
    expect(result[0]).toEqual({
      text: 'item1',
      value: 'item1',
      properties: {
        description: 'Desc 1',
      },
    });
    expect(result[1]).toEqual({
      text: 'item2',
      value: 'item2',
      properties: {
        description: 'Desc 2',
      },
    });
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
