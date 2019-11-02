import React from 'react';
import { Graph } from './Graph';
import { mockGraphData } from './mockGraphWithLegendData';
import Chart from '../Chart';
import { select } from '@storybook/addon-knobs';

export default {
  title: 'Visualizations/Graph/Graph',
  component: Graph,
};

const props = mockGraphData();

const getKnobs = () => {
  return {
    tooltipMode: select(
      'Tooltip mode',
      {
        multi: 'multi',
        single: 'single',
      },
      'single'
    ),
  };
};
export const withTooltip = () => {
  const { tooltipMode } = getKnobs();
  return (
    <div style={{ width: '700px', height: '400px' }}>
      <Graph {...props} tooltipOptions={{ mode: tooltipMode }}>
        <Chart.Tooltip />
      </Graph>
    </div>
  );
};
