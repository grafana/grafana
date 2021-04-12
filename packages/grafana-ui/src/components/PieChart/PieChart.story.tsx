import React from 'react';
import { select, number, boolean } from '@storybook/addon-knobs';
import { PieChart, PieChartType } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import {
  FieldColorModeId,
  FieldConfigSource,
  FieldType,
  InterpolateFunction,
  ReduceDataOptions,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';

export default {
  title: 'Visualizations/PieChart',
  decorators: [withCenteredStory],
  component: PieChart,
};

const fieldConfig: FieldConfigSource = {
  defaults: {
    thresholds: {
      mode: ThresholdsMode.Percentage,
      steps: [{ color: 'green', value: 0 }],
    },
    color: {
      mode: FieldColorModeId.PaletteClassic,
    },
  },
  overrides: [],
};

const reduceOptions: ReduceDataOptions = { calcs: [] };
const replaceVariables: InterpolateFunction = (v) => v;
const datapoints = [
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1618197346845, 1618197346845] },
      { name: 'Living room', type: FieldType.number, values: [19, 21] },
    ],
  }),
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1618197346845, 1618197346845] },
      { name: 'Cellar', type: FieldType.number, values: [5, 6] },
    ],
  }),
];

const getKnobs = () => {
  return {
    width: number('Width', 500),
    height: number('Height', 500),
    pieType: select('pieType', [PieChartType.Pie, PieChartType.Donut], PieChartType.Pie),
    showLabelName: boolean('Label.showName', true),
    showLabelValue: boolean('Label.showValue', false),
    showLabelPercent: boolean('Label.showPercent', false),
  };
};

export const basic = () => {
  const { pieType, width, height } = getKnobs();

  return (
    <PieChart
      width={width}
      height={height}
      replaceVariables={replaceVariables}
      reduceOptions={reduceOptions}
      fieldConfig={fieldConfig}
      data={datapoints}
      pieType={pieType}
    />
  );
};

export const donut = () => {
  const { width, height } = getKnobs();

  return (
    <PieChart
      width={width}
      height={height}
      replaceVariables={replaceVariables}
      reduceOptions={reduceOptions}
      fieldConfig={fieldConfig}
      data={datapoints}
      pieType={PieChartType.Donut}
    />
  );
};
