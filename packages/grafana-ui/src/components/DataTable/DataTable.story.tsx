import { ComponentMeta, ComponentStory } from '@storybook/react';
import React, { useMemo } from 'react';

import { DataTable, Column } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './DataTable.mdx';

const meta: ComponentMeta<typeof DataTable> = {
  title: 'Layout/DataTable',
  component: DataTable,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {},
  },
  args: {},
  argTypes: {},
};

interface TableData {
  label: string;
}

export const Global: ComponentStory<typeof DataTable> = (args) => {
  const columns = useMemo<[Column<TableData>]>(() => [{ id: 'label', header: 'Label', sortType: 'alphanumeric' }], []);
  const data = useMemo(() => [{ label: 'a' }], []);

  return (
    <>
      <DataTable columns={columns} data={data} getRowId={() => '1'}></DataTable>
    </>
  );
};

export default meta;
