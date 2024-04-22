import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useQueryTemplates } from '@grafana/runtime/src/services/queryLibrary/hooks';
import { Column, EmptyState, InteractiveTable } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/';

import { ActionsCell } from './cell/ActionsCell';
import { AddedByCell } from './cell/AddedByCell';
import { DatasourceTypeCell } from './cell/DatasourceTypeCell';
import { DateAddedCell } from './cell/DateAddedCell';
import { PrivateToggleCell } from './cell/PrivateToggleCell';
import { TitleCell } from './cell/TitleCell';
import { QueryTemplateRow } from './utils/view';

const columns: Array<Column<QueryTemplateRow>> = [
  { id: 'title', header: 'Title', cell: TitleCell },
  { id: 'addedBy', header: 'Added by', cell: AddedByCell },
  { id: 'datasourceType', header: 'Datasource', cell: DatasourceTypeCell },
  { id: 'dateAdded', header: 'Date added', cell: DateAddedCell },
  { id: 'privateToggle', header: '', cell: PrivateToggleCell },
  { id: 'actions', header: '', cell: ActionsCell },
];

export function QueryTemplatesList() {
  const { queryTemplates } = useQueryTemplates();

  const styles = useStyles2(getStyles);

  const queryTemplateRows: QueryTemplateRow[] = queryTemplates.map((queryTemplate, index) => ({
    index: index.toString(),
    queryTemplate,
  }));

  if (!queryTemplateRows.length) {
    return <EmptyState message={`Coming soon! ${queryTemplates.length}`} variant="call-to-action" />;
  } else {
    return (
      <InteractiveTable
        className={styles.tableWithSpacing}
        columns={columns}
        data={queryTemplateRows}
        getRowId={(row: { index: string }) => row.index}
      />
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tableWithSpacing: css({
      borderCollapse: 'collapse',
      borderStyle: '0 5px',
    }),
  };
};
