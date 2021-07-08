import { cx } from '@emotion/css';
import { Checkbox, Icon, IconButton, LoadingPlaceholder, useStyles2, useTheme2, FadeTransition } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { Space } from '../Space';
import getStyles from './styles';
import { ResourceRowType, ResourceRow, ResourceRowGroup } from './types';
import { findRow } from './utils';

interface NestedRowsProps {
  rows: ResourceRowGroup;
  level: number;
  selectedRows: ResourceRowGroup;
  requestNestedRows: (row: ResourceRow) => Promise<void>;
  onRowSelectedChange: (row: ResourceRow, selected: boolean) => void;
}

const NestedRows: React.FC<NestedRowsProps> = ({
  rows,
  selectedRows,
  level,
  requestNestedRows,
  onRowSelectedChange,
}) => (
  <>
    {rows.map((row) => (
      <NestedRow
        key={row.id}
        row={row}
        selectedRows={selectedRows}
        level={level}
        requestNestedRows={requestNestedRows}
        onRowSelectedChange={onRowSelectedChange}
      />
    ))}
  </>
);

interface NestedRowProps {
  row: ResourceRow;
  level: number;
  selectedRows: ResourceRowGroup;
  requestNestedRows: (row: ResourceRow) => Promise<void>;
  onRowSelectedChange: (row: ResourceRow, selected: boolean) => void;
}

const NestedRow: React.FC<NestedRowProps> = ({ row, selectedRows, level, requestNestedRows, onRowSelectedChange }) => {
  const styles = useStyles2(getStyles);
  const initialOpenStatus = row.type === ResourceRowType.Subscription ? 'open' : 'closed';
  const [rowStatus, setRowStatus] = useState<'open' | 'closed' | 'loading'>(initialOpenStatus);

  const isSelected = !!selectedRows.find((v) => v.id === row.id);
  const isDisabled = selectedRows.length > 0 && !isSelected;
  const isOpen = rowStatus === 'open';

  const onRowToggleCollapse = async () => {
    if (rowStatus === 'open') {
      setRowStatus('closed');
      return;
    }
    setRowStatus('loading');
    await requestNestedRows(row);
    setRowStatus('open');
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

interface EntryIconProps {
  entry: ResourceRow;
  isOpen: boolean;
}

const EntryIcon: React.FC<EntryIconProps> = ({ isOpen, entry: { type } }) => {
  switch (type) {
    case ResourceRowType.Subscription:
      return <Icon name="layer-group" />;

    case ResourceRowType.ResourceGroup:
      return <Icon name={isOpen ? 'folder-open' : 'folder'} />;

    case ResourceRowType.Resource:
      return <Icon name="cube" />;

    case ResourceRowType.VariableGroup:
      return <Icon name="x" />;

    case ResourceRowType.Variable:
      return <Icon name="x" />;

    default:
      return null;
  }
};

interface NestedEntryProps {
  level: number;
  entry: ResourceRow;
  isSelected: boolean;
  isOpen: boolean;
  isDisabled: boolean;
  onToggleCollapse: (row: ResourceRow) => void;
  onSelectedChange: (row: ResourceRow, selected: boolean) => void;
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
  // Subscriptions, resource groups, resources, and variables are all selectable, so
  // the top-level variable group is the only thing that cannot be selected.
  const isSelectable = entry.type !== ResourceRowType.VariableGroup;

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

  const checkboxId = `checkbox_${entry.id}`;

  return (
    <div className={styles.nestedEntry} style={{ marginLeft: level * (3 * theme.spacing.gridSize) }}>
      {/* When groups are selectable, I *think* we will want to show a 2-wide space instead
            of the collapse button for leaf rows that have no children to get them to align */}

      {hasChildren ? (
        <IconButton
          className={styles.collapseButton}
          name={isOpen ? 'angle-down' : 'angle-right'}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          onClick={handleToggleCollapse}
          id={entry.id}
        />
      ) : (
        <Space layout="inline" h={2} />
      )}

      <Space layout="inline" h={2} />

      {isSelectable && (
        <>
          <Checkbox id={checkboxId} onChange={handleSelectedChanged} disabled={isDisabled} value={isSelected} />
          <Space layout="inline" h={2} />
        </>
      )}

      <EntryIcon entry={entry} isOpen={isOpen} />
      <Space layout="inline" h={1} />

      <label htmlFor={checkboxId} className={cx(styles.entryContentItem, styles.truncated)}>
        {entry.name}
      </label>
    </div>
  );
};

export default NestedRows;
