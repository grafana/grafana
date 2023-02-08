import { cx } from '@emotion/css';
import { Table as PerconaTable } from '@percona/platform-core';
import React from 'react';
import { Column } from 'react-table';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './Table.styles';
import { TableProps } from './Table.types';

const Table = <T extends object>(props: TableProps<T>) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.Table, props.style)}>
      {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
      <PerconaTable {...props} columns={props.columns as Column[]} />
    </div>
  );
};

export default Table;
