import React from 'react';
import { cx } from '@emotion/css';

import { useStyles2 } from '@grafana/ui';

import NestedRows from './NestedRows';
import getStyles from './styles';
import { ResourceRow, ResourceRowGroup } from './types';

interface NestedResourceTableProps {
  rows: ResourceRowGroup;
  selectedRows: ResourceRowGroup;
  noHeader?: boolean;
  requestNestedRows: (row: ResourceRow) => Promise<void>;
  onRowSelectedChange: (row: ResourceRow, selected: boolean) => void;
}

const NestedResourceTable: React.FC<NestedResourceTableProps> = ({
  rows,
  selectedRows,
  noHeader,
  requestNestedRows,
  onRowSelectedChange,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <>
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
      </table>

      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <tbody>
            <NestedRows
              rows={rows}
              selectedRows={selectedRows}
              level={0}
              requestNestedRows={requestNestedRows}
              onRowSelectedChange={onRowSelectedChange}
            />
          </tbody>
        </table>
      </div>
    </>
  );
};

export default NestedResourceTable;
