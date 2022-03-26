import { cx } from '@emotion/css';
import { FadeTransition, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

import { NestedEntry } from './NestedEntry';
import NestedRows from './NestedRows';
import getStyles from './styles';
import { ResourceRow, ResourceRowGroup, ResourceRowType } from './types';
import { findRow } from './utils';

interface NestedRowProps {
  row: ResourceRow;
  level: number;
  selectedRows: ResourceRowGroup;
  requestNestedRows: (row: ResourceRow) => Promise<void>;
  onRowSelectedChange: (row: ResourceRow, selected: boolean) => void;
  selectableEntryTypes: ResourceRowType[];
}

const NestedRow: React.FC<NestedRowProps> = ({
  row,
  selectedRows,
  level,
  requestNestedRows,
  onRowSelectedChange,
  selectableEntryTypes,
}) => {
  const styles = useStyles2(getStyles);
  const [rowStatus, setRowStatus] = useState<'open' | 'closed' | 'loading'>('closed');

  const isSelected = !!selectedRows.find((v) => v.id === row.id);
  const isDisabled = selectedRows.length > 0 && !isSelected;
  const isOpen = rowStatus === 'open';

  const onRowToggleCollapse = async () => {
    if (rowStatus === 'open') {
      setRowStatus('closed');
      return;
    }
    setRowStatus('loading');
    requestNestedRows(row)
      .then(() => setRowStatus('open'))
      .catch(() => setRowStatus('closed'));
  };

  // opens the resource group on load of component if there was a previously saved selection
  useEffect(() => {
    // Assuming we don't have multi-select yet
    const selectedRow = selectedRows[0];

    const containsChild = selectedRow && !!findRow(row.children ?? [], selectedRow.id);

    if (containsChild) {
      setRowStatus('open');
    }
  }, [selectedRows, row]);

  return (
    <>
      <tr className={cx(styles.row, isDisabled && styles.disabledRow)} key={row.id}>
        <td className={styles.cell}>
          <NestedEntry
            level={level}
            isSelected={isSelected}
            isDisabled={isDisabled}
            isOpen={isOpen}
            entry={row}
            onToggleCollapse={onRowToggleCollapse}
            onSelectedChange={onRowSelectedChange}
            isSelectable={selectableEntryTypes.some((type) => type === row.type)}
          />
        </td>

        <td className={styles.cell}>{row.typeLabel}</td>

        <td className={styles.cell}>{row.location ?? '-'}</td>
      </tr>

      {isOpen && row.children && Object.keys(row.children).length > 0 && (
        <NestedRows
          rows={row.children}
          selectedRows={selectedRows}
          level={level + 1}
          requestNestedRows={requestNestedRows}
          onRowSelectedChange={onRowSelectedChange}
          selectableEntryTypes={selectableEntryTypes}
        />
      )}

      <FadeTransition visible={rowStatus === 'loading'}>
        <tr>
          <td className={cx(styles.cell, styles.loadingCell)} colSpan={3}>
            <LoadingPlaceholder text="Loading..." className={styles.spinner} />
          </td>
        </tr>
      </FadeTransition>
    </>
  );
};

export default NestedRow;
