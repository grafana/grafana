import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';

import { applyFormatTime, formatTimeTransformer } from './formatTime';

describe('Format Time Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([formatTimeTransformer]);
  });

  it('will convert time to formatted string', () => {
    const options = {
      timeField: 'time',
      outputFormat: 'YYYY-MM',
      timezone: 'utc',
    };

    const frame = toDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1612939600000, 1689192000000, 1682025600000, 1690328089000, 1691011200000],
        },
      ],
    });

    const newFrames = applyFormatTime(options, [frame]);
    expect(newFrames[0].fields[0].values).toEqual(['2021-02', '2023-07', '2023-04', '2023-07', '2023-08']);
  });

  it('will match on getFieldDisplayName', () => {
    const options = {
      timeField: 'Created',
      outputFormat: 'YYYY-MM',
      timezone: 'utc',
    };

    const frame = toDataFrame({
      fields: [
        {
          name: 'created',
          type: FieldType.time,
          values: [1612939600000, 1689192000000, 1682025600000, 1690328089000, 1691011200000],
          config: {
            displayName: 'Created',
          },
        },
      ],
    });

    const newFrames = applyFormatTime(options, [frame]);
    expect(newFrames[0].fields[0].values).toEqual(['2021-02', '2023-07', '2023-04', '2023-07', '2023-08']);
  });

  it('will handle formats with times', () => {
    const options = {
      timeField: 'time',
      outputFormat: 'YYYY-MM h:mm:ss a',
      timezone: 'utc',
    };

    const frame = toDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1612939600000, 1689192000000, 1682025600000, 1690328089000, 1691011200000],
        },
      ],
    });

    const newFrames = applyFormatTime(options, [frame]);
    expect(newFrames[0].fields[0].values).toEqual([
      '2021-02 6:46:40 am',
      '2023-07 8:00:00 pm',
      '2023-04 9:20:00 pm',
      '2023-07 11:34:49 pm',
      '2023-08 9:20:00 pm',
    ]);
  });

  it('will handle null times', () => {
    const options = {
      timeField: 'time',
      outputFormat: 'YYYY-MM h:mm:ss a',
      timezone: 'utc',
    };

    const frame = toDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: [1612939600000, 1689192000000, 1682025600000, 1690328089000, null],
        },
      ],
    });

    const newFrames = applyFormatTime(options, [frame]);
    expect(newFrames[0].fields[0].values).toEqual([
      '2021-02 6:46:40 am',
      '2023-07 8:00:00 pm',
      '2023-04 9:20:00 pm',
      '2023-07 11:34:49 pm',
      'Invalid date',
    ]);
  });
});
