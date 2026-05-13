import {
  DataFrame,
  FieldType,
  type PanelData,
  toDataFrame,
  TIME_SERIES_TIME_FIELD_NAME,
  getDefaultTimeRange,
} from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { groupDataFramesByLabel } from './SoloPanelWrapper';

describe('SoloPanelWrapper', () => {});

describe('groupDataFramesByLabel', () => {
  it('should group data frames by the specified label', () => {
    const frame1 = toDataFrame({
      fields: [
        { name: TIME_SERIES_TIME_FIELD_NAME, values: [1, 2, 3], type: FieldType.time },
        {
          name: 'command=A CODE=100',
          values: [1, 2, 3],
          type: FieldType.number,
          labels: { code: '100', command: 'A' },
        },
      ],
    });

    const frame2 = toDataFrame({
      fields: [
        { name: TIME_SERIES_TIME_FIELD_NAME, values: [1, 2, 3], type: FieldType.time },
        {
          name: 'commandA CODE=200',
          values: [1, 2, 3],
          type: FieldType.number,
          labels: { code: '200', command: 'A' },
        },
      ],
    });

    const frame3 = toDataFrame({
      fields: [
        { name: TIME_SERIES_TIME_FIELD_NAME, values: [1, 2, 3], type: FieldType.time },
        {
          name: 'command=B CODE=100',
          values: [1, 2, 3],
          type: FieldType.number,
          labels: { code: '100', command: 'B' },
        },
      ],
    });

    const frame4 = toDataFrame({
      fields: [
        { name: TIME_SERIES_TIME_FIELD_NAME, values: [1, 2, 3], type: FieldType.time },
        {
          name: 'command=B CODE=200',
          values: [1, 2, 3],
          type: FieldType.number,
          labels: { code: '200', command: 'B' },
        },
      ],
    });

    const data: PanelData = {
      series: [frame1, frame2, frame3, frame4],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    };

    const grouped = groupDataFramesByLabel(data, 'code');

    expect(grouped).toHaveLength(2);
    expect(grouped[0].series).toEqual([frame1, frame2]);
    expect(grouped[1].series).toEqual([frame3, frame4]);
  });
});
