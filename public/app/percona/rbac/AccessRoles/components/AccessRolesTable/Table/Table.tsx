import { cx } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { Table as PerconaTable } from '../../../../../shared/components/Elements/Table';

import { getStyles } from './Table.styles';
import { TableProps } from './Table.types';

const Table = (props: TableProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.Table, props.style)}>
      {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
      <PerconaTable {...props} columns={props.columns} />
    </div>
  );
};

export default Table;
