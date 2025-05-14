import { FieldType, toDataFrame } from '@grafana/data';

import { getLabelValueFromDataFrame } from './levels';

describe('getLabelValueFromDataFrame', () => {
  it('returns correct label value from data frame', () => {
    expect(
      getLabelValueFromDataFrame(
        toDataFrame({
          fields: [
            { name: 'Time', type: FieldType.time, values: [0] },
            {
              name: 'Value',
              type: FieldType.number,
              values: [1],
              labels: {
                detected_level: 'warn',
              },
            },
          ],
        })
      )
    ).toEqual('warn');
  });
});
