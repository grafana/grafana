import { useStyles2 } from '@grafana/ui';
import React from 'react';
import NestedRows from './NestedRows';
import getStyles from './styles';
import { Row } from './types';

interface NestedResourceTableProps {
  rows: Row[];
}

const NestedResourceTable: React.FC<NestedResourceTableProps> = ({ rows }) => {
  const styles = useStyles2(getStyles);

  return (
    <table className={styles.table}>
      <thead>
        <tr className={styles.header}>
          <td className={styles.cell}>Scope</td>
          <td className={styles.cell}>Type</td>
          <td className={styles.cell}>Location</td>
        </tr>
      </thead>

      <tbody>
        <NestedRows rows={rows} level={0} />
      </tbody>
    </table>
  );
};

export default NestedResourceTable;
