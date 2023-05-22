import { render, screen, fireEvent, waitFor, getByText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { NodeGraph } from './NodeGraph';
import { makeEdgesDataFrame, makeNodesDataFrame } from './utils';

jest.mock('react-use/lib/useMeasure', () => {
  return {
    __esModule: true,
    default: () => {
      return [() => {}, { width: 500, height: 200 }];
    },
  };
});

describe('NodeGraph', () => {
  it('shows no data message without any data', async () => {
    render(<NodeGraph dataFrames={[]} getLinks={() => []} />);

    await screen.findByText('No data');
  });

  it('can zoom in and out', async () => {
    render(
      <NodeGraph
        dataFrames={[makeNodesDataFrame(2), makeEdgesDataFrame([{ source: '0', target: '1' }])]}
        getLinks={() => []}
      />
    );
    const zoomIn = await screen.findByTitle(/Zoom in/);
    const zoomOut = await screen.findByTitle(/Zoom out/);

    expect(getScale()).toBe(1);
    await userEvent.click(zoomIn);
    expect(getScale()).toBe(1.5);
    await userEvent.click(zoomOut);
    expect(getScale()).toBe(1);
  });

  it('can pan the graph', async () => {
    render(
      <NodeGraph
        dataFrames={[
          makeNodesDataFrame(3),
          makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '1', target: '2' },
          ]),
        ]}
        getLinks={() => []}
      />
    );

    await screen.findByLabelText('Node: service:1');

    panView({ x: 10, y: 10 });
    // Though we try to pan down 10px we are rendering in straight line 3 nodes so there are bounds preventing
    // as panning vertically
    await waitFor(() => expect(getTranslate()).toEqual({ x: 10, y: 0 }));
  });

  it('renders with single node', async () => {
    render(<NodeGraph dataFrames={[makeNodesDataFrame(1)]} getLinks={() => []} />);
    const circle = await screen.findByText('', { selector: 'circle' });
    await screen.findByText(/service:0/);
    expect(getXY(circle)).toEqual({ x: 0, y: 0 });
  });

  it('shows context menu when clicking on node or edge', async () => {
    render(
      <NodeGraph
        dataFrames={[makeNodesDataFrame(2), makeEdgesDataFrame([{ source: '0', target: '1' }])]}
        getLinks={(dataFrame) => {
          return [
            {
              title: dataFrame.fields.find((f) => f.name === 'source') ? 'Edge traces' : 'Node traces',
              href: '',
              origin: null,
              target: '_self',
            },
          ];
        }}
      />
    );

    // We mock this because for some reason the simulated click events don't have pageX/Y values resulting in some NaNs
    // for positioning and this creates a warning message.
    const origError = console.error;
    console.error = jest.fn();

    const node = await screen.findByLabelText(/Node: service:0/);
    await userEvent.click(node);
    await screen.findByText(/Node traces/);

    const edge = await screen.findByLabelText(/Edge from/);
    await userEvent.click(edge);
    await screen.findByText(/Edge traces/);
    console.error = origError;
  });

  it('lays out 3 nodes in single line', async () => {
    render(
      <NodeGraph
        dataFrames={[
          makeNodesDataFrame(3),
          makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '1', target: '2' },
          ]),
        ]}
        getLinks={() => []}
      />
    );

    await expectNodePositionCloseTo('service:0', { x: -221, y: 0 });
    await expectNodePositionCloseTo('service:1', { x: -21, y: 0 });
    await expectNodePositionCloseTo('service:2', { x: 221, y: 0 });
  });

  it('lays out first children on one vertical line', async () => {
    render(
      <NodeGraph
        dataFrames={[
          makeNodesDataFrame(3),
          makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '0', target: '2' },
          ]),
        ]}
        getLinks={() => []}
      />
    );

    // Should basically look like <
    await expectNodePositionCloseTo('service:0', { x: -100, y: 0 });
    await expectNodePositionCloseTo('service:1', { x: 100, y: -100 });
    await expectNodePositionCloseTo('service:2', { x: 100, y: 100 });
  });

  it('limits the number of nodes shown and shows a warning', async () => {
    render(
      <NodeGraph
        dataFrames={[
          makeNodesDataFrame(5),
          makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '0', target: '2' },
            { source: '2', target: '3' },
            { source: '3', target: '4' },
          ]),
        ]}
        getLinks={() => []}
        nodeLimit={2}
      />
    );

    const nodes = await screen.findAllByLabelText(/Node: service:\d/);
    expect(nodes.length).toBe(2);
    screen.getByLabelText(/Nodes hidden warning/);

    const markers = await screen.findAllByLabelText(/Hidden nodes marker: \d/);
    expect(markers.length).toBe(1);
  });

  it('allows expanding the nodes when limiting visible nodes', async () => {
    render(
      <NodeGraph
        dataFrames={[
          makeNodesDataFrame(5),
          makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '1', target: '2' },
            { source: '2', target: '3' },
            { source: '3', target: '4' },
          ]),
        ]}
        getLinks={() => []}
        nodeLimit={3}
      />
    );

    const node = await screen.findByLabelText(/Node: service:0/);
    expect(node).toBeInTheDocument();

    const marker = await screen.findByLabelText(/Hidden nodes marker: 3/);
    await userEvent.click(marker);

    expect(screen.queryByLabelText(/Node: service:0/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Node: service:4/)).toBeInTheDocument();

    const nodes = await screen.findAllByLabelText(/Node: service:\d/);
    expect(nodes.length).toBe(3);
  });

  it('can switch to grid layout', async () => {
    render(
      <NodeGraph
        dataFrames={[
          makeNodesDataFrame(3),
          makeEdgesDataFrame([
            { source: '0', target: '1' },
            { source: '1', target: '2' },
          ]),
        ]}
        getLinks={() => []}
        nodeLimit={3}
      />
    );

    const button = await screen.findByTitle(/Grid layout/);
    await userEvent.click(button);

    await expectNodePositionCloseTo('service:0', { x: -60, y: -60 });
    await expectNodePositionCloseTo('service:1', { x: 60, y: -60 });
    await expectNodePositionCloseTo('service:2', { x: -60, y: 80 });
  });
});

async function expectNodePositionCloseTo(node: string, pos: { x: number; y: number }) {
  const nodePos = await getNodeXY(node);
  expect(nodePos.x).toBeCloseTo(pos.x, -1);
  expect(nodePos.y).toBeCloseTo(pos.y, -1);
}

async function getNodeXY(node: string) {
  const group = await screen.findByLabelText(new RegExp(`Node: ${node}`));
  const circle = getByText(group, '', { selector: 'circle' });
  return getXY(circle);
}

function panView(toPos: { x: number; y: number }) {
  const svg = getSvg();
  fireEvent(svg, new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
  fireEvent(document, new MouseEvent('mousemove', { clientX: toPos.x, clientY: toPos.y }));
  fireEvent(document, new MouseEvent('mouseup'));
}

function getSvg() {
  return screen.getAllByText('', { selector: 'svg' })[0];
}

function getTransform() {
  const svg = getSvg();
  const group = svg.children[0] as SVGElement;
  return group.style.getPropertyValue('transform');
}

function getScale() {
  const scale = getTransform().match(/scale\(([\d\.]+)\)/)![1];
  return parseFloat(scale);
}

function getTranslate() {
  const matches = getTransform().match(/translate\((\d+)px, (\d+)px\)/);
  return {
    x: parseFloat(matches![1]),
    y: parseFloat(matches![2]),
  };
}

function getXY(e: Element) {
  return {
    x: parseFloat(e.attributes.getNamedItem('cx')?.value || ''),
    y: parseFloat(e.attributes.getNamedItem('cy')?.value || ''),
  };
}
