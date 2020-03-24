import React from 'react';
import { Table } from './Table';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { number } from '@storybook/addon-knobs';
import { useTheme } from '../../themes';
import mdx from './Table.mdx';
import {
  applyFieldOverrides,
  ConfigOverrideRule,
  DataFrame,
  FieldMatcherID,
  FieldType,
  GrafanaTheme,
  MutableDataFrame,
  ThresholdsConfig,
  ThresholdsMode,
} from '@grafana/data';

export default {
  title: 'Visualizations/Table',
  component: Table,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

function buildData(theme: GrafanaTheme, overrides: ConfigOverrideRule[]): DataFrame {
  const data = new MutableDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [] }, // The time field
      {
        name: 'Quantity',
        type: FieldType.number,
        values: [],
        config: {
          decimals: 0,
          custom: {
            align: 'center',
          },
        },
      },
      { name: 'Status', type: FieldType.string, values: [] }, // The time field
      {
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: {
          decimals: 2,
        },
      },
      {
        name: 'Progress',
        type: FieldType.number,
        values: [],
        config: {
          unit: 'percent',
          custom: {
            width: 100,
          },
        },
      },
    ],
  });

  for (let i = 0; i < 1000; i++) {
    data.appendRow([
      new Date().getTime(),
      Math.random() * 2,
      Math.random() > 0.7 ? 'Active' : 'Cancelled',
      Math.random() * 100,
      Math.random() * 100,
    ]);
  }

  return applyFieldOverrides({
    data: [data],
    fieldOptions: {
      overrides,
      defaults: {},
    },
    theme,
    replaceVariables: (value: string) => value,
  })[0];
}

export const Simple = () => {
  const theme = useTheme();
  const width = number('width', 700, {}, 'Props');
  const data = buildData(theme, []);

  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <Table data={data} height={500} width={width} />
    </div>
  );
};

export const BarGaugeCell = () => {
  const theme = useTheme();
  const width = number('width', 700, {}, 'Props');
  const data = buildData(theme, [
    {
      matcher: { id: FieldMatcherID.byName, options: 'Progress' },
      properties: [
        { prop: 'width', value: '200', custom: true },
        { prop: 'displayMode', value: 'gradient-gauge', custom: true },
        { prop: 'min', value: '0' },
        { prop: 'max', value: '100' },
      ],
    },
  ]);

  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <Table data={data} height={500} width={width} />
    </div>
  );
};

const defaultThresholds: ThresholdsConfig = {
  steps: [
    {
      color: 'blue',
      value: -Infinity,
    },
    {
      color: 'green',
      value: 20,
    },
  ],
  mode: ThresholdsMode.Absolute,
};

export const ColoredCells = () => {
  const theme = useTheme();
  const width = number('width', 750, {}, 'Props');
  const data = buildData(theme, [
    {
      matcher: { id: FieldMatcherID.byName, options: 'Progress' },
      properties: [
        { prop: 'width', value: '80', custom: true },
        { prop: 'displayMode', value: 'color-background', custom: true },
        { prop: 'min', value: '0' },
        { prop: 'max', value: '100' },
        { prop: 'thresholds', value: defaultThresholds },
      ],
    },
  ]);

  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <Table data={data} height={500} width={width} />
    </div>
  );
};
