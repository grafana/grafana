import React from 'react';
import { merge } from 'lodash';
import { Table } from './Table';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { number } from '@storybook/addon-knobs';
import { useTheme } from '../../themes';
import mdx from './Table.mdx';
import {
  applyFieldOverrides,
  DataFrame,
  FieldType,
  GrafanaTheme,
  MutableDataFrame,
  ThresholdsConfig,
  ThresholdsMode,
  FieldConfig,
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

function buildData(theme: GrafanaTheme, config: Record<string, FieldConfig>): DataFrame {
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
            width: 80,
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
          min: 0,
          max: 100,
          custom: {
            width: 150,
          },
        },
      },
    ],
  });

  for (const field of data.fields) {
    field.config = merge(field.config, config[field.name]);
  }

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
    fieldConfig: {
      overrides: [],
      defaults: {},
    },
    theme,
    replaceVariables: (value: string) => value,
  })[0];
}

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

export const Simple = () => {
  const theme = useTheme();
  const width = number('width', 700, {}, 'Props');
  const data = buildData(theme, {});

  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <Table data={data} height={500} width={width} />
    </div>
  );
};

export const BarGaugeCell = () => {
  const theme = useTheme();
  const width = number('width', 700, {}, 'Props');
  const data = buildData(theme, {
    Progress: {
      custom: {
        width: 200,
        displayMode: 'gradient-gauge',
      },
      thresholds: defaultThresholds,
    },
  });

  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <Table data={data} height={500} width={width} />
    </div>
  );
};

export const ColoredCells = () => {
  const theme = useTheme();
  const width = number('width', 750, {}, 'Props');
  const data = buildData(theme, {
    Progress: {
      custom: {
        width: 80,
        displayMode: 'color-background',
      },
      thresholds: defaultThresholds,
    },
  });

  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <Table data={data} height={500} width={width} />
    </div>
  );
};
