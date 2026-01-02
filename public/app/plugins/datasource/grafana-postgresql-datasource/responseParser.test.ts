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

    // Without __text and __value fields, all values are added as text-only entries
    // 150,000 'a' values + 150,000 1 values = 300,000 total
    // After deduplication by text, we get 2 unique items ('a' and 1)
    expect(result).toHaveLength(2);

    const textValues = result.map((r) => r.text);
    expect(textValues).toContain('a');
    expect(textValues).toContain(1);
  });

  it('should add all values from multiple fields without __text/__value (backwards compatible)', () => {
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

    // Without __text and __value, all values from all fields are added as text-only entries
    expect(result).toHaveLength(9);

    // Entries should only have text, no value or properties
    const user1Entry = result.find((r) => r.text === 'user1');
    expect(user1Entry).toEqual({ text: 'user1' });

    const emailEntry = result.find((r) => r.text === 'user1@test.com');
    expect(emailEntry).toEqual({ text: 'user1@test.com' });
  });

  it('should handle single field (backwards compatible)', () => {
    const frame: DataFrame = {
      fields: [{ name: 'name', type: FieldType.string, config: {}, values: ['value1', 'value2'] }],
      length: 2,
    };

    const result = transformMetricFindResponse(frame);

    expect(result).toHaveLength(2);
    // Without __text and __value, values are added as text-only entries
    expect(result[0]).toEqual({ text: 'value1' });
    expect(result[1]).toEqual({ text: 'value2' });
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

  it('should skip fields named "text" or "value" in properties when __text and __value are present', () => {
    const frame: DataFrame = {
      fields: [
        { name: '__text', type: FieldType.string, config: {}, values: ['Display 1', 'Display 2'] },
        { name: '__value', type: FieldType.string, config: {}, values: ['val1', 'val2'] },
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
      text: 'Display 1',
      value: 'val1',
      properties: {
        description: 'Desc 1',
      },
    });
    expect(result[1]).toEqual({
      text: 'Display 2',
      value: 'val2',
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
