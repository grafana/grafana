import { StoryFn, Meta } from '@storybook/react';

import { createDataFrame } from '@grafana/data';

import { DataGrid, DataGridProps } from './DataGrid';
import mdx from './DataGrid.mdx';

const meta: Meta<typeof DataGrid> = {
  title: 'Plugins/DataGrid',
  component: DataGrid,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof DataGrid> = (args: DataGridProps) => {
  return (
    <DataGrid
      {...args}
      data={createDataFrame({
        fields: [
          { name: 'A (number)', values: [123, null] },
          { name: 'B (strings)', values: ['Very long text which we need overflow to see', 'Hello'] },
          { name: 'C (nulls)', values: [null, null] },
          { name: 'Time', values: ['2000', 1967] },
          { name: 'D (number strings)', values: ['NaN', null, 1] },
        ],
      })}
      columns={[
        {
          key: 'A (number)',
          name: 'A (number)',
          width: 150,
        },
        {
          key: 'B (strings)',
          name: 'B (strings)',
          width: 150,
        },
        {
          key: 'C (nulls)',
          name: 'C (nulls)',
          width: 150,
        },
        {
          key: 'Time',
          name: 'Time',
          width: 150,
        },
        {
          key: 'D (number strings)',
          name: 'D (number strings)',
          width: 150,
        },
      ]}
    />
  );
};

export default meta;
