import React from 'react';
import { Table } from './Table';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { number } from '@storybook/addon-knobs';
import { useTheme } from '../../themes';
import mdx from './NewTable.mdx';
import { DataFrame, MutableDataFrame, FieldType, GrafanaTheme, applyFieldOverrides } from '@grafana/data';

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

function buildData(theme: GrafanaTheme): DataFrame {
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
      overrides: [],
      defaults: {},
    },
    theme,
    replaceVariables: (value: string) => value,
  })[0];
}

export const simple = () => {
  const theme = useTheme();
  const width = number('width', 700, {}, 'Props');

  return (
    <div className="panel-container" style={{ width: 'auto' }}>
      <Table data={buildData(theme)} height={500} width={width} />
    </div>
  );
};
