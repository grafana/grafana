import { render, screen } from '@testing-library/react';
import React from 'react';

import { getDefaultTimeRange, MutableDataFrame } from '@grafana/data';

import { UnconnectedNodeGraphContainer } from './NodeGraphContainer';

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

    // Make sure we only show header in the collapsible
    expect(container.firstChild?.childNodes.length).toBe(1);
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

    expect(container.firstChild?.childNodes.length).toBe(2);
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
