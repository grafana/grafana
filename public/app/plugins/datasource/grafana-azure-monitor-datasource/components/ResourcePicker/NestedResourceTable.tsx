import React from 'react';
import { cx } from '@emotion/css';

import { useStyles2 } from '@grafana/ui';

import NestedRows from './NestedRows';
import getStyles from './styles';
import { Row } from './types';

interface NestedResourceTableProps {
  rows: Row[];
  selected: string[];
  noHeader?: boolean;
  onRowToggleCollapse: (row: Row) => void;
  onRowSelectedChange: (row: Row, selected: boolean) => void;
}

const NestedResourceTable: React.FC<NestedResourceTableProps> = ({
  rows,
  selected,
  noHeader,
  onRowToggleCollapse,
  onRowSelectedChange,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <table className={styles.table}>
      {!noHeader && (
        <thead>
          <tr className={cx(styles.row, styles.header)}>
            <td className={styles.cell}>Scope</td>
            <td className={styles.cell}>Type</td>
            <td className={styles.cell}>Location</td>
          </tr>
        </thead>
      )}

      <tbody>
        <NestedRows
          rows={rows}
          selected={selected}
          level={0}
          onRowToggleCollapse={onRowToggleCollapse}
          onRowSelectedChange={onRowSelectedChange}
        />
      </tbody>
    </table>
  );
};

export default NestedResourceTable;
