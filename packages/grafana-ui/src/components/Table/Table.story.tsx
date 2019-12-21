import React from 'react';
import { Table } from './Table';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { number } from '@storybook/addon-knobs';
import { useTheme } from '../../themes';
import mdx from './Table.mdx';
import {
  DataFrame,
  MutableDataFrame,
  FieldType,
  GrafanaTheme,
  applyFieldOverrides,
  FieldMatcherID,
  ConfigOverrideRule,
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
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: {
          decimals: 2,
        },
      },
      {
        name: 'Min',
        type: FieldType.number,
        values: [],
        config: {
          custom: {
            width: 50,
          },
        },
      },
      { name: 'State', type: FieldType.string, values: [] },
    ],
  });

  for (let i = 0; i < 1000; i++) {
    data.appendRow([
      new Date().getTime(),
      Math.random() * 100,
      Math.random() * 100,
      i % 2 === 0 ? 'it is ok now' : 'not so good',
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
      matcher: { id: FieldMatcherID.byName, options: 'Min' },
      properties: [{ path: 'custom.width', value: 200 }],
    },
  ]);

  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <Table data={data} height={500} width={width} />
    </div>
  );
};
