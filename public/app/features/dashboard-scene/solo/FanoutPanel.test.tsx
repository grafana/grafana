import {
  FieldType,
  type PanelData,
  toDataFrame,
  TIME_SERIES_TIME_FIELD_NAME,
  getDefaultTimeRange,
  type DataFrame,
} from '@grafana/data';
import { LoadingState } from '@grafana/schema';

import { groupDataFramesByLabel } from './FanoutPanel';

describe('SoloPanelWrapper', () => {});

describe('groupDataFramesByLabel', () => {
  it('should group data frames by the specified label', () => {
    const frame1 = getTestFrame('command=A CODE=200', { code: '100', command: 'A' });
    const frame2 = getTestFrame('command=A CODE=200', { code: '200', command: 'A' });
    const frame3 = getTestFrame('command=B CODE=100', { code: '100', command: 'B' });
    const frame4 = getTestFrame('command=B CODE=200', { code: '200', command: 'B' });

    const data: PanelData = {
      series: [frame1, frame2, frame3, frame4],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    };

    const grouped = groupDataFramesByLabel(data, 'code');

    expect(grouped).toHaveLength(2);
    expect(grouped[0].frames).toEqual([frame1, frame3]);
    expect(grouped[1].frames).toEqual([frame2, frame4]);
  });
});

function getTestFrame(name: string, labels: Record<string, string>): DataFrame {
  return toDataFrame({
    fields: [
      { name: TIME_SERIES_TIME_FIELD_NAME, values: [1, 2, 3], type: FieldType.time },
      {
        name: name,
        values: [1, 2, 3],
        type: FieldType.number,
        labels,
      },
    ],
  });
}
