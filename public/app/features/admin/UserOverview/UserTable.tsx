import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { type Column, InteractiveTable, useStyles2 } from '@grafana/ui';

export function UserTable<T extends object>({
  columns,
  data,
  getRowId,
}: {
  columns: Array<Column<T>>;
  data: T[];
  getRowId: (row: T) => string;
}) {
  const styles = useStyles2(getStyles);
  return <InteractiveTable className={styles.table} columns={columns} data={data} getRowId={getRowId} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    '& tbody tr:nth-of-type(odd)': { backgroundColor: theme.colors.background.secondary },
  }),
});
