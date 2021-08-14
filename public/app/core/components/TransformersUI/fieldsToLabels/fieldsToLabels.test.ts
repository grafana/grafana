import { FieldType, toDataFrame } from '@grafana/data';
import { fieldsToLabels } from './fieldsToLabels';

describe('Fields to labels', () => {
  it('separates a single frame into multiple', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
          { name: 'Region', type: FieldType.string, values: ['US', 'EU', 'US', 'EU'] },
          { name: 'Value', type: FieldType.number, values: [1, 2, 3, 4] },
        ],
      }),
    ];

    const result = fieldsToLabels({ labelFields: ['Region'] }, input);

    expect(result).toEqual([
      toDataFrame({
        fields: [
          { labels: { Region: 'US' }, name: 'Time', type: FieldType.time, values: [1000, 2000] },
          { labels: { Region: 'US' }, name: 'Value', type: FieldType.number, values: [1, 3] },
        ],
      }),
      toDataFrame({
        fields: [
          { labels: { Region: 'EU' }, name: 'Time', type: 'time', values: [1000, 2000] },
          { labels: { Region: 'EU' }, name: 'Value', type: FieldType.number, values: [2, 4] },
        ],
      }),
    ]);
  });

  it('passes through other labels', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
          { name: 'Region', type: FieldType.string, values: ['US', 'EU', 'US', 'EU'] },
          { name: 'Value', type: FieldType.number, values: [1, 2, 3, 4], labels: { Environment: 'Production' } },
        ],
      }),
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 2000] },
          { name: 'Region', type: FieldType.string, values: ['US', 'US'] },
          { name: 'Value', type: FieldType.number, values: [5, 6], labels: { Environment: 'Staging' } },
        ],
      }),
    ];

    const result = fieldsToLabels({ labelFields: ['Region'] }, input);

    expect(result).toEqual([
      toDataFrame({
        fields: [
          {
            labels: { Environment: 'Production', Region: 'US' },
            name: 'Time',
            type: FieldType.time,
            values: [1000, 2000],
          },
          {
            labels: { Environment: 'Production', Region: 'US' },
            name: 'Value',
            type: FieldType.number,
            values: [1, 3],
          },
        ],
      }),
      toDataFrame({
        fields: [
          {
            labels: { Environment: 'Production', Region: 'EU' },
            name: 'Time',
            type: FieldType.time,
            values: [1000, 2000],
          },
          {
            labels: { Environment: 'Production', Region: 'EU' },
            name: 'Value',
            type: FieldType.number,
            values: [2, 4],
          },
        ],
      }),
      toDataFrame({
        fields: [
          {
            labels: { Environment: 'Staging', Region: 'US' },
            name: 'Time',
            type: FieldType.time,
            values: [1000, 2000],
          },
          {
            labels: { Environment: 'Staging', Region: 'US' },
            name: 'Value',
            type: FieldType.number,
            values: [5, 6],
          },
        ],
      }),
    ]);
  });

  it('works with empty options', () => {
    const input = [
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 2000] },
          { name: 'Value', type: FieldType.number, values: [1, 2] },
        ],
      }),
    ];

    const result = fieldsToLabels({}, input);

    expect(result).toEqual(input);
  });
});
