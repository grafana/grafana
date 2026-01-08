import { render, screen } from '@testing-library/react';

import { getDefaultTimeRange, MutableDataFrame } from '@grafana/data';
import { NodeDatum } from 'app/plugins/panel/nodeGraph/types';

import { UnconnectedNodeGraphContainer } from './NodeGraphContainer';

jest.mock('../../../plugins/panel/nodeGraph/createLayoutWorker', () => {
  const createMockWorker = () => {
    const onmessage = jest.fn();
    const postMessage = jest.fn();
    const terminate = jest.fn();

    const worker = {
      onmessage: onmessage,
      postMessage: postMessage,
      terminate: terminate,
    };

    postMessage.mockImplementation((data) => {
      if (worker.onmessage) {
        const event = {
          data: {
            nodes: (data.nodes || []).map((n: NodeDatum) => ({ ...n, x: 0, y: 0 })),
            edges: data.edges || [],
          },
        };
        setTimeout(() => worker.onmessage(event), 0);
      }
    });

    return worker;
  };

  return {
    __esModule: true,
    createWorker: createMockWorker,
    createMsaglWorker: createMockWorker,
  };
});

describe('NodeGraphContainer', () => {
  it('is collapsed if shown with traces', () => {
    const { container } = render(
      <UnconnectedNodeGraphContainer
        dataFrames={[emptyFrame]}
        exploreId={'left'}
        range={getDefaultTimeRange()}
        splitOpenFn={() => {}}
        withTraceView={true}
        datasourceType={''}
      />
    );

    // Make sure we only show header and loading bar container from PanelChrome in the collapsible
    expect(container.firstChild?.childNodes.length).toBe(2);
  });

  it('shows the graph if not with trace view', async () => {
    const { container } = render(
      <UnconnectedNodeGraphContainer
        dataFrames={[nodes]}
        exploreId={'left'}
        range={getDefaultTimeRange()}
        splitOpenFn={() => {}}
        datasourceType={''}
      />
    );

    expect(container.firstChild?.childNodes.length).toBe(3);
    expect(container.querySelector('svg')).toBeInTheDocument();
    await screen.findByLabelText(/Node: tempo-querier/);
  });
});

const emptyFrame = new MutableDataFrame();

const nodes = new MutableDataFrame({
  fields: toFields([
    ['id', ['3fa414edcef6ad90']],
    ['title', ['tempo-querier']],
    ['subTitle', ['HTTP GET - api_traces_traceid']],
    ['mainStat', ['1049.14ms (100%)']],
    ['secondaryStat', ['1047.29ms (99.82%)']],
    ['color', [0.9982395121342127]],
  ]),
});

function toFields(fields: Array<[string, unknown[]]>) {
  return fields.map(([name, values]) => {
    return { name, values };
  });
}
