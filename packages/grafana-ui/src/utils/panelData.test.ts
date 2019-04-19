import { filterPanelDataToQuery, isSameDataQueryRequest } from './panelData';
import { LoadingState } from '../types/data';
import { PanelData } from '../types/panel';
import { DataQueryRequest } from '../types/index';

function makePretendRequest(requestId: string, subRequests?: DataQueryRequest[]): DataQueryRequest {
  return {
    requestId,
    subRequests,
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

  it('should put the correct subRequest on the message', () => {
    const panelData = filterPanelDataToQuery(data, 'C');
    expect(panelData.series.length).toBe(1);
    expect(panelData.series[0].refId).toBe('C');
    expect(panelData.request!.requestId).toBe('sub3');
  });
});

describe('isSameDataQueryRequest', () => {
  const request = makePretendRequest('111', [
    makePretendRequest('sub1'),
    makePretendRequest('sub2'),
    makePretendRequest('sub3'),
  ]);

  it('should think a child is the same request', () => {
    expect(isSameDataQueryRequest(request, request)).toBeTruthy();
    expect(isSameDataQueryRequest(request, request.subRequests![0])).toBeTruthy();
  });
});
