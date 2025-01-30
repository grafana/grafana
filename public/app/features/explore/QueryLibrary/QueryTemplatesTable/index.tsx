import { css } from '@emotion/css';
import { SortByFn } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { Column, InteractiveTable, useStyles2 } from '@grafana/ui';

import { QueryActionButton } from '../types';

import ActionsCell from './ActionsCell';
import { AddedByCell } from './AddedByCell';
import { DatasourceTypeCell } from './DatasourceTypeCell';
import { DateAddedCell } from './DateAddedCell';
import { QueryDescriptionCell } from './QueryDescriptionCell';
import { QueryTemplateRow } from './types';

const timestampSort: SortByFn<QueryTemplateRow> = (rowA, rowB, _, desc) => {
  const timeA = rowA.original.createdAtTimestamp || 0;
  const timeB = rowB.original.createdAtTimestamp || 0;
  return desc ? timeA - timeB : timeB - timeA;
};

function createColumns(queryActionButton?: QueryActionButton): Array<Column<QueryTemplateRow>> {
  return [
    { id: 'description', header: 'Data source and query', cell: QueryDescriptionCell },
    { id: 'addedBy', header: 'Added by', cell: ({ row: { original } }) => <AddedByCell user={original.user} /> },
    { id: 'datasourceType', header: 'Datasource type', cell: DatasourceTypeCell, sortType: 'string' },
    { id: 'createdAtTimestamp', header: 'Date added', cell: DateAddedCell, sortType: timestampSort },
    {
      id: 'actions',
      header: '',
      cell: ({ row: { original } }) => (
        <ActionsCell
          queryTemplate={original}
          rootDatasourceUid={original.datasourceRef?.uid}
          queryUid={original.uid}
          QueryActionButton={queryActionButton}
        />
      ),
    },
  ];
}

type Props = {
  queryTemplateRows: QueryTemplateRow[];
  queryActionButton?: QueryActionButton;
};

export default function QueryTemplatesTable({ queryTemplateRows, queryActionButton }: Props) {
  const styles = useStyles2(getStyles);
  const columns = createColumns(queryActionButton);

  return (
    <InteractiveTable
      columns={columns}
      data={queryTemplateRows}
      getRowId={(row: { index: string }) => row.index}
      pageSize={20}
      className={styles.table}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    'tbody tr': {
      position: 'relative',
      backgroundColor: theme.colors.background.secondary,
      borderCollapse: 'collapse',
      borderBottom: 'unset',
      overflow: 'hidden', // Ensure the row doesn't overflow and cause additonal scrollbars
    },
    /* Adds the pseudo-element for the lines between table rows */
    'tbody tr::after': {
      content: '""',
      position: 'absolute',
      inset: 'auto 0 0 0',
      height: theme.spacing(0.5),
      backgroundColor: theme.colors.background.primary,
    },
  }),
});
