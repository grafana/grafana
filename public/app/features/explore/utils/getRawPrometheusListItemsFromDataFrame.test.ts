import { DataFrame, FieldType, FormattedValue, toDataFrame } from '@grafana/data/src';

import { getRawPrometheusListItemsFromDataFrame } from './getRawPrometheusListItemsFromDataFrame';

describe('getRawPrometheusListItemsFromDataFrame', () => {
  it('Parses empty dataframe', () => {
    const dataFrame: DataFrame = { fields: [], length: 0 };
    const result = getRawPrometheusListItemsFromDataFrame(dataFrame);
    expect(result).toEqual([]);
  });

  it('Parses mock dataframe', () => {
    const display = (value: string, decimals?: number): FormattedValue => {
      return { text: value };
    };
    const dataFrame = toDataFrame({
      name: 'A',
      fields: [
        { display, name: 'Time', type: FieldType.time, values: [3000, 4000, 5000, 6000, 7000, 8000] },
        {
          display,
          name: '__name__',
          type: FieldType.string,
          values: ['ALERTS', 'ALERTS', 'ALERTS', 'ALERTS_FOR_STATE', 'ALERTS_FOR_STATE', 'ALERTS_FOR_STATE'],
        },
        { display, name: 'Value', type: FieldType.number, values: [1, 2, 3, 4, 5, 6] },
        { display, name: 'attribute', type: FieldType.number, values: [7, 8, 9, 10, 11, 12] },
      ],
    });
    const result = getRawPrometheusListItemsFromDataFrame(dataFrame);
    const differenceBetweenValueAndAttribute = 6;
    result.forEach((row) => {
      expect(parseInt(row.attribute, 10)).toEqual(parseInt(row.Value, 10) + differenceBetweenValueAndAttribute);
    });
  });
});
