import React from 'react';
import { object, select, number, boolean } from '@storybook/addon-knobs';
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
    width: number('Width', 500),
    height: number('Height', 500),
    pieType: select('pieType', [PieChartType.Pie, PieChartType.Donut], PieChartType.Pie),
    showLabelName: boolean('Label.showName', true),
    showLabelValue: boolean('Label.showValue', false),
    showLabelPercent: boolean('Label.showPercent', false),
  };
};

export const basic = () => {
  const { datapoints, pieType, width, height, showLabelName, showLabelPercent, showLabelValue } = getKnobs();
  const labelOptions = { showName: showLabelName, showPercent: showLabelPercent, showValue: showLabelValue };

  return <PieChart width={width} height={height} values={datapoints} pieType={pieType} labelOptions={labelOptions} />;
};

export const donut = () => {
  const { datapoints, width, height, showLabelName, showLabelPercent, showLabelValue } = getKnobs();
  const labelOptions = { showName: showLabelName, showPercent: showLabelPercent, showValue: showLabelValue };

  return (
    <PieChart
      width={width}
      height={height}
      values={datapoints}
      pieType={PieChartType.Donut}
      labelOptions={labelOptions}
    />
  );
};
