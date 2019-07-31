import { LoadingState, createField } from '@grafana/data';
import { PanelData, DataQueryRequest } from '@grafana/ui';
import { filterPanelDataToQuery } from './QueryEditorRow';

function makePretendRequest(requestId: string, subRequests?: DataQueryRequest[]): DataQueryRequest {
  return {
    requestId,
    // subRequests,
  } as DataQueryRequest;
}

describe('filterPanelDataToQuery', () => {
  const data: PanelData = {
    state: LoadingState.Done,
    series: [
      { refId: 'A', fields: [createField('AAA')], meta: {} },
      { refId: 'B', fields: [createField('B111')], meta: {} },
      { refId: 'B', fields: [createField('B222')], meta: {} },
      { refId: 'B', fields: [createField('B333')], meta: {} },
      { refId: 'C', fields: [createField('CCCC')], meta: { requestId: 'sub3' } },
    ],
    error: {
      refId: 'B',
      message: 'Error!!',
    },
    request: makePretendRequest('111', [
      makePretendRequest('sub1'),
      makePretendRequest('sub2'),
      makePretendRequest('sub3'),
    ]),
  };

  it('should not have an error unless the refId matches', () => {
    const panelData = filterPanelDataToQuery(data, 'A');
    expect(panelData.series.length).toBe(1);
    expect(panelData.series[0].refId).toBe('A');
    expect(panelData.error).toBeUndefined();
  });

  it('should match the error to the query', () => {
    const panelData = filterPanelDataToQuery(data, 'B');
    expect(panelData.series.length).toBe(3);
    expect(panelData.series[0].refId).toBe('B');
    expect(panelData.error!.refId).toBe('B');
  });
});
