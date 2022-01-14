import React, { FC } from 'react';
import { useTheme } from '@grafana/ui';
import { ActiveCheck, Column } from 'app/percona/check/types';
import { getStyles } from './Table.styles';
import { TableHeader } from './TableHeader';
import { TableBody } from './TableBody';

interface TableProps {
  columns: Column[];
  data?: ActiveCheck[];
}

export const Table: FC<TableProps> = ({ columns, data = [] }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const isEmpty = !data.length;

  return (
    <>
      <div className={styles.wrapper}>
        {isEmpty ? (
          <div className={styles.empty} data-qa="db-check-panel-table-empty">
            No failed checks.
          </div>
        ) : (
          <table className={styles.table} data-qa="db-check-panel-table">
            <TableHeader columns={columns} />
            <TableBody data={data} />
          </table>
        )}
      </div>
    </>
  );
};
