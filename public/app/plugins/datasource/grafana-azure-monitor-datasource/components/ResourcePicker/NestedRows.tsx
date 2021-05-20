import { cx } from '@emotion/css';
import { Checkbox, Icon, IconButton, LoadingPlaceholder, useStyles2, useTheme2, FadeTransition } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import getStyles from './styles';
import { EntryType, Row, RowGroup } from './types';

interface NestedRowsProps {
  rows: RowGroup;
  level: number;
  selectedRows: RowGroup;
  requestNestedRows: (row: Row) => Promise<void>;
  onRowSelectedChange: (row: Row, selected: boolean) => void;
}

const NestedRows: React.FC<NestedRowsProps> = ({
  rows,
  selectedRows,
  level,
  requestNestedRows,
  onRowSelectedChange,
}) => (
  <>
    {Object.keys(rows).map((rowId) => (
      <NestedRow
        key={rowId}
        row={rows[rowId]}
        selectedRows={selectedRows}
        level={level}
        requestNestedRows={requestNestedRows}
        onRowSelectedChange={onRowSelectedChange}
      />
    ))}
  </>
);

interface NestedRowProps {
  row: Row;
  level: number;
  selectedRows: RowGroup;
  requestNestedRows: (row: Row) => Promise<void>;
  onRowSelectedChange: (row: Row, selected: boolean) => void;
}

const NestedRow: React.FC<NestedRowProps> = ({ row, selectedRows, level, requestNestedRows, onRowSelectedChange }) => {
  const styles = useStyles2(getStyles);

  const isSelected = !!selectedRows[row.id];
  const isDisabled = Object.keys(selectedRows).length > 0 && !isSelected;
  const initialOpenStatus = row.type === EntryType.Collection ? 'open' : 'closed';
  const [openStatus, setOpenStatus] = useState<'open' | 'closed' | 'loading'>(initialOpenStatus);
  const isOpen = openStatus === 'open';

  const onRowToggleCollapse = async () => {
    if (openStatus === 'open') {
      setOpenStatus('closed');
      return;
    }
    setOpenStatus('loading');
    await requestNestedRows(row);
    setOpenStatus('open');
  };

  // opens the resource group on load of component if there was a previously saved selection
  useEffect(() => {
    const selectedRow = Object.keys(selectedRows).map((rowId) => selectedRows[rowId])[0];
    const isSelectedResourceGroup =
      selectedRow && selectedRow.resourceGroupName && row.name === selectedRow.resourceGroupName;
    if (isSelectedResourceGroup) {
      setOpenStatus('open');
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
        />
      )}

      <FadeTransition visible={openStatus === 'loading'}>
        <tr>
          <td className={cx(styles.cell, styles.loadingCell)} colSpan={3}>
            <LoadingPlaceholder text="Loading..." className={styles.spinner} />
          </td>
        </tr>
      </FadeTransition>
    </>
  );
};

interface EntryIconProps {
  entry: Row;
  isOpen: boolean;
}

const EntryIcon: React.FC<EntryIconProps> = ({ isOpen, entry: { type } }) => {
  switch (type) {
    case EntryType.Collection:
      return <Icon name="layer-group" />;

    case EntryType.SubCollection:
      return <Icon name={isOpen ? 'folder-open' : 'folder'} />;

    case EntryType.Resource:
      return <Icon name="cube" />;

    default:
      return null;
  }
};

interface NestedEntryProps {
  level: number;
  entry: Row;
  isSelected: boolean;
  isOpen: boolean;
  isDisabled: boolean;
  onToggleCollapse: (row: Row) => void;
  onSelectedChange: (row: Row, selected: boolean) => void;
}

const NestedEntry: React.FC<NestedEntryProps> = ({
  entry,
  isSelected,
  isDisabled,
  isOpen,
  level,
  onToggleCollapse,
  onSelectedChange,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const hasChildren = !!entry.children;
  const isSelectable = entry.type === EntryType.Resource;

  const handleToggleCollapse = useCallback(() => {
    onToggleCollapse(entry);
  }, [onToggleCollapse, entry]);

  const handleSelectedChanged = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const isSelected = ev.target.checked;
      onSelectedChange(entry, isSelected);
    },
    [entry, onSelectedChange]
  );

  return (
    <div className={styles.nestedEntry} style={{ marginLeft: level * (3 * theme.spacing.gridSize) }}>
      {/* When groups are selectable, I *think* we will want to show a 2-wide space instead
            of the collapse button for leaf rows that have no children to get them to align */}
      <span className={styles.entryContentItem}>
        {hasChildren && (
          <IconButton
            className={styles.collapseButton}
            name={isOpen ? 'angle-down' : 'angle-right'}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
            onClick={handleToggleCollapse}
          />
        )}

        {isSelectable && <Checkbox onChange={handleSelectedChanged} disabled={isDisabled} value={isSelected} />}
      </span>

      <span className={styles.entryContentItem}>
        <EntryIcon entry={entry} isOpen={isOpen} />
      </span>

      <span className={cx(styles.entryContentItem, styles.truncated)}>{entry.name}</span>
    </div>
  );
};

export default NestedRows;
