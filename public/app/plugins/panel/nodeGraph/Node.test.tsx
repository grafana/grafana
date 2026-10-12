import { render, screen } from '@testing-library/react';

import { createTheme, FieldType } from '@grafana/data';

import { Node } from './Node';
import { type NodeDatum } from './types';

const theme = createTheme();

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

  it('renders correct node radius', async () => {
    render(
      <svg>
        <Node
          node={{ ...nodeDatum, nodeRadius: { name: 'nodeRadius', values: [20], type: FieldType.number, config: {} } }}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          onClick={() => {}}
          hovering={'default'}
        />
      </svg>
    );

    expect(screen.getByTestId('node-circle-1')).toHaveAttribute('r', '20');
  });

  it('fills highlighted nodes with the highlight colour rather than the panel background', () => {
    render(
      <svg>
        <Node
          node={{ ...nodeDatum, highlighted: true }}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          onClick={() => {}}
          hovering={'default'}
        />
      </svg>
    );

    expect(screen.getByTestId('node-circle-1')).toHaveStyle({ fill: '#a00' });
  });

  it('strokes the hover ring with the accent colour', () => {
    render(
      <svg>
        <Node node={nodeDatum} onMouseEnter={() => {}} onMouseLeave={() => {}} onClick={() => {}} hovering={'active'} />
      </svg>
    );

    expect(screen.getByTestId('node-hover-circle-1')).toHaveStyle({ stroke: theme.colors.accent.text });
  });
});

const nodeDatum: NodeDatum = {
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
  highlighted: false,
};
