import { cx } from '@emotion/css';
import React, { useCallback, useEffect } from 'react';

import { Checkbox, IconButton, useStyles2, useTheme2 } from '@grafana/ui';

import { Space } from '../Space';

import { EntryIcon } from './EntryIcon';
import getStyles from './styles';
import { ResourceRow } from './types';

interface NestedEntryProps {
  level: number;
  entry: ResourceRow;
  isSelected: boolean;
  isSelectable: boolean;
  isOpen: boolean;
  isDisabled: boolean;
  scrollIntoView?: boolean;
  onToggleCollapse: (row: ResourceRow) => void;
  onSelectedChange: (row: ResourceRow, selected: boolean) => void;
}

export const NestedEntry: React.FC<NestedEntryProps> = ({
  entry,
  isSelected,
  isDisabled,
  isOpen,
  isSelectable,
  level,
  scrollIntoView,
  onToggleCollapse,
  onSelectedChange,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const hasChildren = !!entry.children;

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

  const checkboxId = `${scrollIntoView ? 'table' : 'summary'}_checkbox_${entry.uri}`;

  // Scroll to the selected element if it's not in the view
  // Only do it once, when the component is mounted
  useEffect(() => {
    if (isSelected && scrollIntoView) {
      document.getElementById(checkboxId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.nestedEntry} style={{ marginLeft: level * (3 * theme.spacing.gridSize) }}>
      {hasChildren ? (
        <IconButton
          className={styles.collapseButton}
          name={isOpen ? 'angle-down' : 'angle-right'}
          aria-label={isOpen ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
          onClick={handleToggleCollapse}
          id={entry.id}
        />
      ) : (
        <Space layout="inline" h={2} />
      )}

      <Space layout="inline" h={2} />

      {isSelectable && (
        <>
          <Checkbox
            id={checkboxId}
            onChange={handleSelectedChanged}
            disabled={isDisabled}
            value={isSelected}
            className={styles.nestedRowCheckbox}
          />
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
