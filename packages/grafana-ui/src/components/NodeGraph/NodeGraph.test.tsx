import React from 'react';
import { render, screen, fireEvent, waitFor, getByText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeGraph } from './NodeGraph';
import { ArrayVector, FieldType, MutableDataFrame } from '@grafana/data';

describe('NodeGraph', () => {
  it('doesnt fail without any data', async () => {
    render(<NodeGraph dataFrames={[]} getLinks={() => []} />);
  });

  it('can zoom in and out', async () => {
    render(<NodeGraph dataFrames={[]} getLinks={() => []} />);
    const zoomIn = await screen.findByTitle(/Zoom in/);
    const zoomOut = await screen.findByTitle(/Zoom out/);
    const zoomLevel = await screen.findByTitle(/Zoom level/);

    expect(zoomLevel.textContent).toContain('1.00x');

    expect(getScale()).toBe(1);
    userEvent.click(zoomIn);
    expect(getScale()).toBe(1.5);
    userEvent.click(zoomOut);
    expect(getScale()).toBe(1);
  });

  it('can pan the graph', async () => {
    render(
      <NodeGraph
        dataFrames={[
          makeNodesDataFrame(3),
          makeEdgesDataFrame([
            [0, 1],
            [1, 2],
          ]),
        ]}
        getLinks={() => []}
      />
    );

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
        dataFrames={[makeNodesDataFrame(2), makeEdgesDataFrame([[0, 1]])]}
        getLinks={dataFrame => {
          return [
            {
              title: dataFrame.fields.find(f => f.name === 'source') ? 'Edge traces' : 'Node traces',
              href: '',
              origin: null,
              target: '_self',
            },
          ];
        }}
      />
    );
    const node = await screen.findByLabelText(/Node: service:0/);
    // This shows warning because there is no position for the click. We cannot add any because we use pageX/Y in the
    // context menu which is experimental (but supported) property and userEvents does not seem to support that
    userEvent.click(node);
    await screen.findByText(/Node traces/);

    const edge = await screen.findByLabelText(/Edge from/);
    userEvent.click(edge);
    await screen.findByText(/Edge traces/);
  });

  it('lays out 3 nodes in single line', async () => {
    render(
      <NodeGraph
        dataFrames={[
          makeNodesDataFrame(3),
          makeEdgesDataFrame([
            [0, 1],
            [1, 2],
          ]),
        ]}
        getLinks={() => []}
      />
    );

    screen.debug();

    expect(getNodeXY('service:0').x).toBeCloseTo(-221, -1);
    expect(getNodeXY('service:0').y).toBeCloseTo(0, -1);

    expect(getNodeXY('service:1').x).toBeCloseTo(-21, -1);
    expect(getNodeXY('service:1').y).toBeCloseTo(0, -1);

    expect(getNodeXY('service:2').x).toBeCloseTo(221, -1);
    expect(getNodeXY('service:2').y).toBeCloseTo(0, -1);
  });
});

function getNodeXY(node: string) {
  const group = screen.getByLabelText(new RegExp(`Node: ${node}`));
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

function makeNodesDataFrame(count: number) {
  const frame = nodesFrame();
  for (let i = 0; i < count; i++) {
    frame.add(makeNode(i));
  }

  return frame;
}

function makeNode(index: number) {
  return {
    id: index.toString(),
    title: `service:${index}`,
    subTitle: 'service',
    success: 0.5,
    error: 0.5,
    stat1: 0.1,
    stat2: 2,
  };
}

function nodesFrame() {
  const fields: any = {
    id: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    title: {
      values: new ArrayVector(),
      type: FieldType.string,
      labels: { NodeGraphValueType: 'title' },
    },
    subTitle: {
      values: new ArrayVector(),
      type: FieldType.string,
      labels: { NodeGraphValueType: 'subTitle' },
    },
    stat1: {
      values: new ArrayVector(),
      type: FieldType.number,
      labels: { NodeGraphValueType: 'mainStat' },
    },
    stat2: {
      values: new ArrayVector(),
      type: FieldType.number,
      labels: { NodeGraphValueType: 'secondaryStat' },
    },
    success: {
      values: new ArrayVector(),
      type: FieldType.number,
      labels: { NodeGraphValueType: 'arc' },
      config: { color: { fixedColor: 'green' } },
    },
    error: {
      values: new ArrayVector(),
      type: FieldType.number,
      labels: { NodeGraphValueType: 'arc' },
      config: { color: { fixedColor: 'red' } },
    },
  };

  return new MutableDataFrame({
    name: 'nodes',
    fields: Object.keys(fields).map(key => ({
      ...fields[key],
      name: key,
    })),
    meta: { preferredVisualisationType: 'nodeGraph' },
  });
}

function makeEdgesDataFrame(edges: Array<[number, number]>) {
  const frame = edgesFrame();
  for (const edge of edges) {
    frame.add({
      id: edge[0] + '--' + edge[1],
      source: edge[0].toString(),
      target: edge[1].toString(),
    });
  }

  return frame;
}

function edgesFrame() {
  const fields: any = {
    id: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    source: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    target: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
  };

  return new MutableDataFrame({
    name: 'edges',
    fields: Object.keys(fields).map(key => ({
      ...fields[key],
      name: key,
    })),
    meta: { preferredVisualisationType: 'nodeGraph' },
  });
}
