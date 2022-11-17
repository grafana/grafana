import { ComponentMeta, ComponentStory } from '@storybook/react';
import React, { useMemo } from 'react';

import { InteractiveTable, Column, CellProps, LinkButton } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './InteractiveTable.mdx';

const EXCLUDED_PROPS = ['className', 'renderExpandedRow', 'getRowId'];

const meta: ComponentMeta<typeof InteractiveTable> = {
  title: 'Experimental/InteractiveTable',
  component: InteractiveTable,
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
  noheader?: string;
}

export const Basic: ComponentStory<typeof InteractiveTable> = (args) => {
  const columns = useMemo<Array<Column<TableData>>>(
    () => [
      { id: 'header2', header: 'With missing values', sortType: 'number', disableGrow: true },
      {
        id: 'noheader',
        sortType: 'number',
      },
    ],
    []
  );
  const data: TableData[] = useMemo(
    () => [
      { header1: 'a', header2: 1 },
      { header1: 'b', noheader: "This column doesn't have an header" },
      { header1: 'c', noheader: "But it's still sortable" },
    ],
    []
  );

  return <InteractiveTable columns={columns} data={data} getRowId={(r) => r.header1} />;
};

interface WithRowExpansionData {
  datasource: string;
  repo: string;
  description: string;
}

const ExpandedCell = ({ description }: WithRowExpansionData) => {
  return <p>{description}</p>;
};

export const WithRowExpansion: ComponentStory<typeof InteractiveTable> = (args) => {
  const tableData: WithRowExpansionData[] = [
    {
      datasource: 'Prometheus',
      repo: 'https://github.com/prometheus/prometheus',
      description: 'Open source time series database & alerting.',
    },
    {
      datasource: 'Loki',
      repo: 'https://github.com/grafana/loki',
      description: 'Like Prometheus but for logs. OSS logging solution from Grafana Labs.',
    },
    {
      datasource: 'Tempo',
      repo: 'https://github.com/grafana/tempo',
      description: 'High volume, minimal dependency trace storage. OSS tracing solution from Grafana Labs.',
    },
  ];

  const columns: Array<Column<WithRowExpansionData>> = [
    { id: 'datasource', header: 'Data Source' },
    { id: 'repo', header: 'Repo' },
  ];

  return (
    <InteractiveTable
      columns={columns}
      data={tableData}
      getRowId={(r) => r.datasource}
      renderExpandedRow={ExpandedCell}
    />
  );
};

interface WithCustomCellData {
  datasource: string;
  repo: string;
}

const RepoCell = ({
  row: {
    original: { repo },
  },
}: CellProps<WithCustomCellData, void>) => {
  return (
    <LinkButton href={repo} size="sm" icon="external-link-alt">
      Open on GithHub
    </LinkButton>
  );
};

export const WithCustomCell: ComponentStory<typeof InteractiveTable> = (args) => {
  const tableData: WithCustomCellData[] = [
    {
      datasource: 'Prometheus',
      repo: 'https://github.com/prometheus/prometheus',
    },
    {
      datasource: 'Loki',
      repo: 'https://github.com/grafana/loki',
    },
    {
      datasource: 'Tempo',
      repo: 'https://github.com/grafana/tempo',
    },
  ];

  const columns: Array<Column<WithCustomCellData>> = [
    { id: 'datasource', header: 'Data Source' },
    { id: 'repo', header: 'Repo', cell: RepoCell },
  ];

  return <InteractiveTable columns={columns} data={tableData} getRowId={(r) => r.datasource} />;
};

export default meta;
