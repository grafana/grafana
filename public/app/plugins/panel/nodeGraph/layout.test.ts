import { act, renderHook } from '@testing-library/react';

import { useLayout } from './layout';
import { EdgeDatum, NodeDatum } from './types';

let onmessage: jest.Mock;
let postMessage: jest.Mock;
let terminate: jest.Mock;
let worker: {
  onmessage: (e: MessageEvent) => void;
  postMessage: (d: unknown) => void;
  terminate: () => void;
};

jest.mock('./createLayoutWorker', () => {
  return {
    __esModule: true,
    createWorker: () => {
      onmessage = jest.fn();
      postMessage = jest.fn();
      terminate = jest.fn();
      worker = {
        onmessage: onmessage,
        postMessage: postMessage,
        terminate: terminate,
      };
      return worker;
    },
    createMsaglWorker: () => {
      onmessage = jest.fn();
      postMessage = jest.fn();
      terminate = jest.fn();
      worker = {
        onmessage: onmessage,
        postMessage: postMessage,
        terminate: terminate,
      };
      return worker;
    },
  };
});

describe('layout', () => {
  it('doesnt fail without any data', async () => {
    const nodes: NodeDatum[] = [];
    const edges: EdgeDatum[] = [];

    const { result } = renderHook(() => {
      return useLayout(nodes, edges, undefined, 100, 1000);
    });
    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
    expect(postMessage).toBeUndefined();
  });

  it('cancels worker', async () => {
    const { result, rerender } = renderHook(
      ({ nodes, edges }) => {
        return useLayout(nodes, edges, undefined, 100, 1000);
      },
      {
        initialProps: {
          nodes: [makeNode(0, 0), makeNode(1, 1)],
          edges: [makeEdge(0, 1)],
        },
      }
    );
    expect(postMessage).toBeCalledTimes(1);
    // Bit convoluted but we cannot easily access the worker instance as we only export constructor so the default
    // export is class and we only store latest instance of the methods as jest.fn here as module local variables.
    // So we capture the terminate function from current worker so that when we call rerender and new worker is created
    // we can still access and check the method from the old one that we assume should be canceled.
    const localTerminate = terminate;

    rerender({
      nodes: [],
      edges: [],
    });

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
    expect(localTerminate).toBeCalledTimes(1);
  });

  it('correctly maps the layout data', async () => {
    // This specifically tests whether the mapping of data from the layout code back to the original nodes is correct.

    const { result, rerender } = renderHook(
      ({ nodes, edges }) => {
        return useLayout(nodes, edges, undefined, 100, 1000);
      },
      { initialProps: { nodes: rawNodes, edges: rawEdges } }
    );

    // Simulate response from the layout worker
    act(() => {
      worker.onmessage(new MessageEvent('message', { data: { nodes: testNodes, edges: testEdges } }));
    });

    rerender({ nodes: rawNodes, edges: rawEdges });

    expect(result.current.nodes).toMatchObject([
      { id: 'otel-demo-alt/frontend', title: 'frontend' },
      { id: 'otel-demo-alt/cartservice', title: 'cartservice' },
      { id: 'otel-demo-alt/checkoutservice', title: 'checkoutservice' },
      { id: 'otel-demo-alt/frontend-proxy', title: 'frontend-proxy' },
      { id: 'otel-demo-alt/recommendationservice', title: 'recommendationservice' },
    ]);
  });
});

function makeNode(index: number, incoming: number): NodeDatum {
  return {
    id: `n${index}`,
    title: `n${index}`,
    subTitle: '',
    dataFrameRowIndex: 0,
    incoming,
    arcSections: [],
    highlighted: false,
  };
}

function makeEdge(source: number, target: number): EdgeDatum {
  return {
    id: `${source}-${target}`,
    source: 'n' + source,
    target: 'n' + target,
    mainStat: '',
    secondaryStat: '',
    dataFrameRowIndex: 0,
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    highlighted: false,
    thickness: 1,
  };
}

const rawNodes: NodeDatum[] = [
  {
    dataFrameRowIndex: 0,
    id: 'otel-demo-alt/cartservice',
    incoming: 1,
    subTitle: 'otel-demo-alt',
    title: 'cartservice',
    highlighted: false,
    arcSections: [],
  },
  {
    dataFrameRowIndex: 1,
    id: 'otel-demo-alt/frontend',
    incoming: 1,
    subTitle: 'otel-demo-alt',
    title: 'frontend',
    highlighted: false,
    arcSections: [],
  },
  {
    dataFrameRowIndex: 2,
    id: 'otel-demo-alt/checkoutservice',
    incoming: 1,
    subTitle: 'otel-demo-alt',
    title: 'checkoutservice',
    highlighted: false,
    arcSections: [],
  },
  {
    dataFrameRowIndex: 3,
    id: 'otel-demo-alt/frontend-proxy',
    incoming: 1,
    subTitle: 'otel-demo-alt',
    title: 'frontend-proxy',
    highlighted: false,
    arcSections: [],
  },
  {
    dataFrameRowIndex: 4,
    id: 'otel-demo-alt/recommendationservice',
    incoming: 1,
    subTitle: 'otel-demo-alt',
    title: 'recommendationservice',
    highlighted: false,
    arcSections: [],
  },
];

const rawEdges = [
  {
    id: 'otel-demo-alt/frontend_otel-demo-alt/cartservice',
    dataFrameRowIndex: 0,
    source: 'otel-demo-alt/frontend',
    target: 'otel-demo-alt/cartservice',
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '1.08 ms/r',
    secondaryStat: '0.93 r/sec',
    highlighted: false,
    thickness: 1,
  },
  {
    id: 'otel-demo-alt/frontend_otel-demo-alt/checkoutservice',
    dataFrameRowIndex: 1,
    source: 'otel-demo-alt/frontend',
    target: 'otel-demo-alt/checkoutservice',
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '12.66 ms/r',
    secondaryStat: '0.12 r/sec',
    highlighted: false,
    thickness: 1,
  },
  {
    id: 'otel-demo-alt/frontend_otel-demo-alt/frontend-proxy',
    dataFrameRowIndex: 2,
    source: 'otel-demo-alt/frontend',
    target: 'otel-demo-alt/frontend-proxy',
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '7.45 ms/r',
    secondaryStat: '0.99 r/sec',
    highlighted: false,
    thickness: 1,
  },
  {
    id: 'otel-demo-alt/frontend_otel-demo-alt/recommendationservice',
    dataFrameRowIndex: 3,
    source: 'otel-demo-alt/frontend',
    target: 'otel-demo-alt/recommendationservice',
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '13.01 ms/r',
    secondaryStat: '0.18 r/sec',
    highlighted: false,
    thickness: 1,
  },
  {
    id: 'otel-demo-alt/frontend-proxy_otel-demo-alt/frontend',
    dataFrameRowIndex: 4,
    source: 'otel-demo-alt/frontend-proxy',
    target: 'otel-demo-alt/frontend',
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '7.50 ms/r',
    secondaryStat: '6.06 r/sec',
    highlighted: false,
    thickness: 1,
  },
];

const testNodes = [
  {
    id: 'otel-demo-alt/frontend',
    incoming: 1,
    x: -80.84375,
    y: -70.49999999999997,
  },
  {
    id: 'otel-demo-alt/cartservice',
    incoming: 1,
    x: 80.84375,
    y: 211.5,
  },
  {
    id: 'otel-demo-alt/checkoutservice',
    incoming: 1,
    x: 80.84375,
    y: 70.5,
  },
  {
    id: 'otel-demo-alt/frontend-proxy',
    incoming: 1,
    x: 80.84375,
    y: -70.5,
  },
  {
    id: 'otel-demo-alt/recommendationservice',
    incoming: 1,
    x: 80.84375,
    y: -211.5,
  },
];

const testEdges = [
  {
    id: 'otel-demo-alt/frontend_otel-demo-alt/cartservice',
    dataFrameRowIndex: 0,
    source: {
      id: 'otel-demo-alt/frontend',
      incoming: 1,
      x: -80.84375,
      y: -70.49999999999997,
    },
    target: {
      id: 'otel-demo-alt/cartservice',
      incoming: 1,
      x: 80.84375,
      y: 211.5,
    },
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '1.07 ms/r',
    secondaryStat: '1.08 r/sec',
    highlighted: false,
    thickness: 1,
  },
  {
    id: 'otel-demo-alt/frontend_otel-demo-alt/checkoutservice',
    dataFrameRowIndex: 1,
    source: {
      id: 'otel-demo-alt/frontend',
      incoming: 1,
      x: -80.84375,
      y: -70.49999999999997,
    },
    target: {
      id: 'otel-demo-alt/checkoutservice',
      incoming: 1,
      x: 80.84375,
      y: 70.5,
    },
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '8.18 ms/r',
    secondaryStat: '0.14 r/sec',
    highlighted: false,
    thickness: 1,
  },
  {
    id: 'otel-demo-alt/frontend_otel-demo-alt/frontend-proxy',
    dataFrameRowIndex: 2,
    source: {
      id: 'otel-demo-alt/frontend',
      incoming: 1,
      x: -80.84375,
      y: -70.49999999999997,
    },
    target: {
      id: 'otel-demo-alt/frontend-proxy',
      incoming: 1,
      x: 80.84375,
      y: -70.5,
    },
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '7.57 ms/r',
    secondaryStat: '1.14 r/sec',
    highlighted: false,
    thickness: 1,
  },
  {
    id: 'otel-demo-alt/frontend_otel-demo-alt/recommendationservice',
    dataFrameRowIndex: 3,
    source: {
      id: 'otel-demo-alt/frontend',
      incoming: 1,
      x: -80.84375,
      y: -70.49999999999997,
    },
    target: {
      id: 'otel-demo-alt/recommendationservice',
      incoming: 1,
      x: 80.84375,
      y: -211.5,
    },
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '8.60 ms/r',
    secondaryStat: '0.22 r/sec',
    highlighted: false,
    thickness: 1,
  },
  {
    id: 'otel-demo-alt/frontend-proxy_otel-demo-alt/frontend',
    dataFrameRowIndex: 4,
    source: {
      id: 'otel-demo-alt/frontend-proxy',
      incoming: 1,
      x: 80.84375,
      y: -70.5,
    },
    target: {
      id: 'otel-demo-alt/frontend',
      incoming: 1,
      x: -80.84375,
      y: -70.49999999999997,
    },
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    mainStat: '7.53 ms/r',
    secondaryStat: '6.82 r/sec',
    highlighted: false,
    thickness: 1,
  },
];
