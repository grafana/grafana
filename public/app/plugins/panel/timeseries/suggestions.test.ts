import { createDataFrame, FieldType, getPanelDataSummary } from '@grafana/data';

import { timeseriesSuggestionsSupplier } from './suggestions';

describe('timeseries panel suggestions', () => {
  it('should not suggest timeseries if this is an instant query', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [1625247600000],
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [10],
          },
        ],
      }),
      createDataFrame({
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [1625247600000],
          },
          {
            name: 'value2',
            type: FieldType.number,
            values: [20],
          },
        ],
      }),
    ]);

    expect(dataSummary.isInstant).toBe(true);

    expect(timeseriesSuggestionsSupplier(dataSummary)).toBeUndefined();
  });
});
