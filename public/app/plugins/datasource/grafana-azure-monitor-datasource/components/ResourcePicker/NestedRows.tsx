import { cx } from '@emotion/css';
import { Checkbox, HorizontalGroup, Icon, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import React, { Fragment, useCallback } from 'react';
import getStyles from './styles';
import { EntryType, Row } from './types';

interface NestedRowsProps {
  rows: Row[];
  level: number;
  selected: string[];
  onRowToggleCollapse: (row: Row) => void;
  onRowSelectedChange: (row: Row, selected: boolean) => void;
}

const NestedRows: React.FC<NestedRowsProps> = ({ rows, selected, level, onRowToggleCollapse, onRowSelectedChange }) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      {rows.map((row) => {
        const isSelected = selected.includes(row.id);
        const isDisabled = selected.length > 0 && !isSelected;

        return (
          <Fragment key={row.id}>
            <tr className={cx(styles.row, isDisabled && styles.disabledRow)} key={row.id}>
              <td className={styles.cell}>
                <NestedEntry
                  level={level}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  entry={row}
                  onToggleCollapse={onRowToggleCollapse}
                  onSelectedChange={onRowSelectedChange}
                />
              </td>

              <td className={styles.cell}>{row.typeLabel}</td>

              <td className={styles.cell}>{row.location ?? '-'}</td>
            </tr>

            {row.isOpen && row.children && (
              <NestedRows
                rows={row.children}
                selected={selected}
                level={level + 1}
                onRowToggleCollapse={onRowToggleCollapse}
                onRowSelectedChange={onRowSelectedChange}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
};

interface EntryIconProps {
  entry: Row;
}

const EntryIcon: React.FC<EntryIconProps> = ({ entry: { type, isOpen } }) => {
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
  isDisabled: boolean;
  onToggleCollapse: (row: Row) => void;
  onSelectedChange: (row: Row, selected: boolean) => void;
}

const NestedEntry: React.FC<NestedEntryProps> = ({
  entry,
  isSelected,
  isDisabled,
  level,
  onToggleCollapse,
  onSelectedChange,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

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
    <div style={{ marginLeft: level * (3 * theme.spacing.gridSize) }}>
      <HorizontalGroup align="center" spacing="sm">
        {/* When groups are selectable, I *think* we will want to show a 2-wide space instead
            of the collapse button for leaf rows that have no children to get them to align */}
        {entry.hasChildren && (
          <IconButton
            className={styles.collapseButton}
            name={entry.isOpen ? 'angle-down' : 'angle-right'}
            aria-label={entry.isOpen ? 'Collapse' : 'Expand'}
            onClick={handleToggleCollapse}
          />
        )}

        {entry.isSelectable && <Checkbox onChange={handleSelectedChanged} disabled={isDisabled} value={isSelected} />}

        <EntryIcon entry={entry} />

        {entry.name}
      </HorizontalGroup>
    </div>
  );
};

export default NestedRows;
