import { cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { FadeTransition, LoadingPlaceholder, useStyles2 } from '@grafana/ui';

import { NestedEntry } from './NestedEntry';
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
  scrollIntoView?: boolean;
}

const NestedRow: React.FC<NestedRowProps> = ({
  row,
  selectedRows,
  level,
  requestNestedRows,
  onRowSelectedChange,
  selectableEntryTypes,
  scrollIntoView,
}) => {
  const styles = useStyles2(getStyles);
  const [rowStatus, setRowStatus] = useState<'open' | 'closed' | 'loading'>('closed');

  const isSelected = !!selectedRows.find((v) => v.uri === row.uri);
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

    const containsChild = selectedRow && !!findRow(row.children ?? [], selectedRow.uri);

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
            scrollIntoView={scrollIntoView}
          />
        </td>

        <td className={styles.cell}>{row.typeLabel}</td>

        <td className={styles.cell}>{row.location ?? '-'}</td>
      </tr>

      {isOpen &&
        row.children &&
        Object.keys(row.children).length > 0 &&
        row.children.map((childRow) => (
          <NestedRow
            key={childRow.uri}
            row={childRow}
            selectedRows={selectedRows}
            level={level + 1}
            requestNestedRows={requestNestedRows}
            onRowSelectedChange={onRowSelectedChange}
            selectableEntryTypes={selectableEntryTypes}
            scrollIntoView={scrollIntoView}
          />
        ))}

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
