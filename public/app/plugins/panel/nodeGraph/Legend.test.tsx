import { render, screen } from '@testing-library/react';
import React from 'react';

import { FieldColorModeId } from '@grafana/data';

import { Legend } from './Legend';
import { NodeDatum } from './types';

describe('Legend', () => {
  it('renders ok without nodes', () => {
    render(<Legend nodes={[]} onSort={(sort) => {}} sortable={false} />);
  });

  it('renders ok with color fields', () => {
    const nodes = [
      {
        id: 'nodeId',
        mainStat: { config: { displayName: 'stat1' } },
        secondaryStat: { config: { displayName: 'stat2' } },
        arcSections: [{ config: { displayName: 'error', color: { mode: FieldColorModeId.Fixed, fixedColor: 'red' } } }],
      },
    ] as NodeDatum[];
    render(<Legend nodes={nodes} onSort={(sort) => {}} sortable={false} />);
    const items = screen.getAllByLabelText(/VizLegend series/);
    expect(items.length).toBe(3);

    const item = screen.getByLabelText(/VizLegend series error/);
    expect((item.firstChild as HTMLDivElement).style.getPropertyValue('background')).toBe('rgb(242, 73, 92)');
  });
});
