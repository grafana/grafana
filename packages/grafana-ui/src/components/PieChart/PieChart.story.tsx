import React from 'react';
import { object, select, number, boolean } from '@storybook/addon-knobs';
import { PieChart, PieChartType } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { FieldConfig } from '@grafana/data';

export default {
  title: 'Visualizations/PieChart',
  decorators: [withCenteredStory],
  component: PieChart,
};

const fieldConfig: FieldConfig = {
  displayName: '',
  min: 0,
  max: 10,
  decimals: 10,
  thresholds: {} as any,
  noValue: 'no value',
  unit: 'km/s',
  links: {} as any,
};

const getKnobs = () => {
  return {
    datapoints: object('datapoints', [
      { field: fieldConfig, hasLinks: false, name: 'USA', display: { numeric: 100, text: '100', title: 'USA' } },
      { field: fieldConfig, hasLinks: false, name: 'Canada', display: { numeric: 200, text: '200', title: 'Canada' } },
      { field: fieldConfig, hasLinks: false, name: 'Sweden', display: { numeric: 20, text: '20', title: 'Sweden' } },
      { field: fieldConfig, hasLinks: false, name: 'Spain', display: { numeric: 50, text: '50', title: 'Spain' } },
      { field: fieldConfig, hasLinks: false, name: 'Germany', display: { numeric: 70, text: '70', title: 'Germeny' } },
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
  const { datapoints, pieType, width, height } = getKnobs();

  return <PieChart width={width} height={height} fieldDisplayValues={datapoints} pieType={pieType} />;
};

export const donut = () => {
  const { datapoints, width, height } = getKnobs();

  return <PieChart width={width} height={height} fieldDisplayValues={datapoints} pieType={PieChartType.Donut} />;
};
