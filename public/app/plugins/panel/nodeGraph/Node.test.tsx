import { render, screen } from '@testing-library/react';
import React from 'react';

import { FieldType } from '@grafana/data/src';

import { Node } from './Node';

describe('Node', () => {
  it('renders correct data', async () => {
    render(
      <svg>
        <Node
          node={nodeDatum}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          onClick={() => {}}
          hovering={'default'}
        />
      </svg>
    );

    expect(screen.getByText('node title')).toBeInTheDocument();
    expect(screen.getByText('node subtitle')).toBeInTheDocument();
    expect(screen.getByText('1234.00')).toBeInTheDocument();
    expect(screen.getByText('9876.00')).toBeInTheDocument();
  });

  it('renders icon', async () => {
    render(
      <svg>
        <Node
          node={{ ...nodeDatum, icon: 'database' }}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          onClick={() => {}}
          hovering={'default'}
        />
      </svg>
    );

    expect(screen.getByTestId('node-icon-database')).toBeInTheDocument();
  });
});

const nodeDatum = {
  x: 0,
  y: 0,
  id: '1',
  title: 'node title',
  subTitle: 'node subtitle',
  dataFrameRowIndex: 0,
  incoming: 0,
  mainStat: { name: 'stat', values: [1234], type: FieldType.number, config: {} },
  secondaryStat: { name: 'stat2', values: [9876], type: FieldType.number, config: {} },
  arcSections: [],
};
