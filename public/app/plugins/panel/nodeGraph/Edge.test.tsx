import { render, screen } from '@testing-library/react';

import { FieldType } from '@grafana/data';

import { Edge } from './Edge';
import { type EdgeDatumLayout, type NodeDatum } from './types';

describe('Edge', () => {
  it('strokes uncoloured edges with the default edge colour', () => {
    render(
      <svg>
        <Edge
          edge={makeEdge()}
          hovering={false}
          svgIdNamespace="test"
          onClick={() => {}}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
        />
      </svg>
    );

    expect(screen.getByTestId('edge-line-a-b')).toHaveAttribute('stroke', '#999');
  });

  it('strokes highlighted edges with the highlight colour', () => {
    render(
      <svg>
        <Edge
          edge={makeEdge({ highlighted: true })}
          hovering={false}
          svgIdNamespace="test"
          onClick={() => {}}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
        />
      </svg>
    );

    expect(screen.getByTestId('edge-line-a-b')).toHaveAttribute('stroke', '#a00');
  });

  it('keeps an explicit edge colour instead of the highlight default', () => {
    render(
      <svg>
        <Edge
          edge={makeEdge({ highlighted: true, color: '#00ff00' })}
          hovering={false}
          svgIdNamespace="test"
          onClick={() => {}}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
        />
      </svg>
    );

    expect(screen.getByTestId('edge-line-a-b')).toHaveAttribute('stroke', '#00ff00');
  });
});

function makeNode(id: string, x: number): NodeDatum {
  return {
    id,
    x,
    y: 0,
    title: id,
    subTitle: '',
    dataFrameRowIndex: 0,
    incoming: 0,
    arcSections: [],
    highlighted: false,
    mainStat: { name: 'stat', values: [0], type: FieldType.number, config: {} },
  };
}

function makeEdge(overrides: Partial<EdgeDatumLayout> = {}): EdgeDatumLayout {
  return {
    id: 'a-b',
    source: makeNode('a', 0),
    target: makeNode('b', 100),
    mainStat: '',
    secondaryStat: '',
    dataFrameRowIndex: 0,
    sourceNodeRadius: 40,
    targetNodeRadius: 40,
    highlighted: false,
    thickness: 1,
    ...overrides,
  };
}
