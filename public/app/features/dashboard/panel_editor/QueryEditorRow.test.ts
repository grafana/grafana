import { PanelData, LoadingState, DataQueryRequest } from '@grafana/ui';
import { filterPanelDataToQuery } from './QueryEditorRow';

function makePretendRequest(requestId: string, subRequests?: DataQueryRequest[]): DataQueryRequest {
  return {
    requestId,
    // subRequests,
  } as DataQueryRequest;
}

describe('filterPanelDataToQuery', () => {
  const data = {
    state: LoadingState.Done,
    series: [
      { refId: 'A', fields: [{ name: 'AAA' }], rows: [], meta: {} },
      { refId: 'B', fields: [{ name: 'B111' }], rows: [], meta: {} },
      { refId: 'B', fields: [{ name: 'B222' }], rows: [], meta: {} },
      { refId: 'B', fields: [{ name: 'B333' }], rows: [], meta: {} },
      { refId: 'C', fields: [{ name: 'CCCC' }], rows: [], meta: { requestId: 'sub3' } },
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
  } as PanelData;

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
