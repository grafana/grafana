import React from 'react';
import { number, object, select } from '@storybook/addon-knobs';
import { PieChart, PieChartType } from './PieChart';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Visualizations/PieChart',
  decorators: [withCenteredStory],
  component: PieChart,
};

const getKnobs = () => {
  return {
    datapoints: object('datapoints', [
      {
        numeric: 100,
        text: '100',
        color: '#7EB26D',
      },
      {
        numeric: 200,
        text: '200',
        color: '#6ED0E0',
      },
    ]),
    pieType: select('pieType', [PieChartType.PIE, PieChartType.DONUT], PieChartType.PIE),
    strokeWidth: number('strokeWidth', 1),
  };
};

export const basic = () => {
  const { datapoints, pieType, strokeWidth } = getKnobs();

  return <PieChart width={200} height={400} values={datapoints} pieType={pieType} strokeWidth={strokeWidth} />;
};
