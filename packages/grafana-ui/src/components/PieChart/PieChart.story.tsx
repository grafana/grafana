import React from 'react';
import { number, object, select } from '@storybook/addon-knobs';
import { PieChart, PieChartType } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Visualizations/PieChart',
  decorators: [withCenteredStory],
  component: PieChart,
};

const getKnobs = () => {
  return {
    datapoints: object('datapoints', [
      { numeric: 100, text: '100', title: 'USA' },
      { numeric: 200, text: '200', title: 'Canada' },
      { numeric: 20, text: '20', title: 'Sweden' },
      { numeric: 50, text: '50', title: 'Spain' },
      { numeric: 70, text: '70', title: 'Germeny' },
    ]),
    pieType: select('pieType', [PieChartType.Pie, PieChartType.Donut], PieChartType.Pie),
  };
};

export const basic = () => {
  const { datapoints, pieType } = getKnobs();

  return <PieChart width={500} height={500} values={datapoints} pieType={pieType} />;
};
