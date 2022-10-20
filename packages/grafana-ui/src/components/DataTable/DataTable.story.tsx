import { ComponentMeta, ComponentStory } from '@storybook/react';
import React, { useMemo } from 'react';

import { DataTable, Column, Badge } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './DataTable.mdx';

const EXCLUDED_PROPS = ['className', 'renderExpandedRow', 'getRowId'];

const meta: ComponentMeta<typeof DataTable> = {
  title: 'Experimental/DataTable',
  component: DataTable,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: EXCLUDED_PROPS,
    },
  },
  args: {},
  argTypes: {},
};

interface TableData {
  header1: string;
  header2?: number;
}

export const Global: ComponentStory<typeof DataTable> = (args) => {
  const columns = useMemo<Array<Column<TableData>>>(
    () => [
      { id: 'header1', header: 'Header 1', sortType: 'alphanumeric' },
      { id: 'header2', header: 'With missing values', sortType: 'number', shrink: true },
      {
        id: 'noheader',
        sortType: 'number',
      },
      {
        id: 'customcontent',
        header: 'Not Sortable',
        cell: () => <Badge color="green" text="I'm custom content!" />,
      },
    ],
    []
  );
  const data = useMemo(
    () => [
      { header1: 'a', header2: 1 },
      { header1: 'b', noheader: "This column doesn't have an header" },
      { header1: 'c', noheader: "But it's still sortable" },
    ],
    []
  );

  return (
    <>
      <DataTable columns={columns} data={data} getRowId={(r) => r.header1} renderExpandedRow={() => null} />
    </>
  );
};

export default meta;
