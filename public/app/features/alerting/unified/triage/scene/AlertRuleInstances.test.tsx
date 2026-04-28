import { FieldType, toDataFrame } from '@grafana/data';

import { extractInstancesFromData } from './AlertRuleInstances';

describe('AlertRuleInstances - extractInstancesFromData', () => {
  it('groups series by labels, stripping alertstate from the grouping key', () => {
    // Two series for the same instance in different alert states (firing/pending) should
    // be merged into one group because alertstate is excluded from the key.
    const series = [
      toDataFrame({
        name: 'firing',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 2000] },
          {
            name: 'Value',
            type: FieldType.number,
            values: [1, 1],
            labels: { environment: 'stg', host_name: 'host-0', alertstate: 'firing' },
          },
        ],
      }),
      toDataFrame({
        name: 'pending',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000, 2000] },
          {
            name: 'Value',
            type: FieldType.number,
            values: [0, 1],
            labels: { environment: 'stg', host_name: 'host-0', alertstate: 'pending' },
          },
        ],
      }),
    ];

    const instances = extractInstancesFromData(series);

    // Both series share the same labels minus alertstate → one instance with two series
    expect(instances).toHaveLength(1);
    expect(instances[0].labels).toEqual({ environment: 'stg', host_name: 'host-0' });
    expect(instances[0].series).toHaveLength(2);
  });

  it('produces separate instances for series with different label sets', () => {
    // When the query has already been scoped to the parent group (e.g. environment=stg),
    // only matching series are returned by PromQL and extractInstancesFromData processes them.
    // This test verifies that distinct label combos produce distinct instance rows.
    const series = [
      toDataFrame({
        name: 'firing',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000] },
          {
            name: 'Value',
            type: FieldType.number,
            values: [1],
            labels: { environment: 'stg', host_name: 'host-0', alertstate: 'firing' },
          },
        ],
      }),
      toDataFrame({
        name: 'firing',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000] },
          {
            name: 'Value',
            type: FieldType.number,
            values: [1],
            labels: { environment: 'stg', host_name: 'host-1', alertstate: 'firing' },
          },
        ],
      }),
    ];

    const instances = extractInstancesFromData(series);

    expect(instances).toHaveLength(2);
    expect(instances[0].labels).toEqual({ environment: 'stg', host_name: 'host-0' });
    expect(instances[1].labels).toEqual({ environment: 'stg', host_name: 'host-1' });
  });

  it('returns empty array for undefined input', () => {
    expect(extractInstancesFromData(undefined)).toEqual([]);
  });

  it('skips series with no value field', () => {
    const series = [
      toDataFrame({
        fields: [{ name: 'Time', type: FieldType.time, values: [1000] }],
      }),
    ];

    expect(extractInstancesFromData(series)).toEqual([]);
  });
});
