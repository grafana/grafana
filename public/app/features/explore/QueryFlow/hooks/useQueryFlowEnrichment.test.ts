import { renderHook, waitFor, act } from '@testing-library/react';

import { getDefaultTimeRange } from '@grafana/data';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { useSelector } from 'app/types/store';

import { QueryFlowNodeKind, type QueryFlowGraph } from '../model/types';

import { useQueryFlowEnrichment } from './useQueryFlowEnrichment';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
  reportInteraction: jest.fn(),
}));

jest.mock('app/types/store', () => ({
  useSelector: jest.fn(),
}));

const NODE_ID = 'selector:0-11';
// Stable reference — mirrors the store holding one range object (a fresh one each render would
// churn the cache-reset effect).
const RANGE = getDefaultTimeRange();

function graph(): QueryFlowGraph {
  return {
    language: 'logql',
    rootId: NODE_ID,
    nodes: {
      [NODE_ID]: {
        id: NODE_ID,
        kind: QueryFlowNodeKind.Selector,
        language: 'logql',
        label: '{job="app"}',
        span: { from: 0, to: 11 },
        childIds: [],
      },
    },
    errors: [],
  };
}

function setup(getStats: jest.Mock) {
  (useSelector as jest.Mock).mockImplementation((selector) =>
    selector({ explore: { panes: { left: { range: RANGE, queryResponse: undefined } } } })
  );
  (getDataSourceSrv as jest.Mock).mockReturnValue({
    get: jest.fn().mockResolvedValue({ type: 'loki', getStats }),
  });

  return renderHook(() =>
    useQueryFlowEnrichment({
      graph: graph(),
      exploreId: 'left',
      refId: 'A',
      expr: '{job="app"}',
      datasourceType: 'loki',
      datasourceUid: 'loki-uid',
    })
  );
}

describe('useQueryFlowEnrichment', () => {
  it('fetches nothing until a node is requested, then caches the result', async () => {
    const getStats = jest.fn().mockResolvedValue({ streams: 3, chunks: 1, bytes: 1024, entries: 10 });
    const { result } = setup(getStats);

    // Lazy: no fetch on render.
    expect(result.current.getEnrichment(NODE_ID)).toBeUndefined();
    expect(getStats).not.toHaveBeenCalled();

    act(() => result.current.requestEnrichment(NODE_ID));

    await waitFor(() => expect(result.current.getEnrichment(NODE_ID)?.state).toBe('done'));
    expect(result.current.getEnrichment(NODE_ID)?.badge).toMatch(/3 streams/);
    expect(getStats).toHaveBeenCalledTimes(1);

    // Re-request is served from cache — no second fetch.
    act(() => result.current.requestEnrichment(NODE_ID));
    expect(getStats).toHaveBeenCalledTimes(1);
  });

  it('reports a hover interaction once per new fetch, not on cached re-requests', async () => {
    (reportInteraction as jest.Mock).mockClear();
    const getStats = jest.fn().mockResolvedValue({ streams: 1, chunks: 1, bytes: 1, entries: 1 });
    const { result } = setup(getStats);

    act(() => result.current.requestEnrichment(NODE_ID));
    await waitFor(() => expect(result.current.getEnrichment(NODE_ID)?.state).toBe('done'));
    act(() => result.current.requestEnrichment(NODE_ID));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_query_flow_node_hover', {
      nodeKind: QueryFlowNodeKind.Selector,
    });
    expect(reportInteraction).toHaveBeenCalledTimes(1);
  });
});
