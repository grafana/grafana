import { useState } from 'react';

import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';

import getStyles from '../styles';

type Props<T> = {
  items: T[];
  onChange: (items: T[]) => void;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  maxVisibleItems: number;
  clearTitle: string;
  clearBody: string;
};

export const SelectionChipList = <T,>({
  items,
  onChange,
  getKey,
  getLabel,
  maxVisibleItems,
  clearTitle,
  clearBody,
}: Props<T>) => {
  const styles = useStyles2(getStyles);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedSelectionKey, setExpandedSelectionKey] = useState<string | null>(null);
  const selectionKey = JSON.stringify(items.map(getKey));
  const visibleItems = expandedSelectionKey === selectionKey ? items : items.slice(0, maxVisibleItems);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.selectedLogGroupsContainer}>
        {visibleItems.map((item) => {
          const key = getKey(item);
          return (
            <Button
              key={key}
              size="sm"
              variant="secondary"
              icon="times"
              className={styles.removeButton}
              onClick={() => onChange(items.filter((existingItem) => getKey(existingItem) !== key))}
            >
              {getLabel(item)}
            </Button>
          );
        })}
        {visibleItems.length !== items.length && (
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            fill="outline"
            className={styles.removeButton}
            onClick={() => setExpandedSelectionKey(selectionKey)}
          >
            Show all
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          icon="times"
          fill="outline"
          className={styles.removeButton}
          onClick={() => setShowConfirm(true)}
        >
          Clear selection
        </Button>
      </div>
      <ConfirmModal
        isOpen={showConfirm}
        title={clearTitle}
        body={clearBody}
        confirmText="Yes"
        dismissText="No"
        onConfirm={() => {
          setShowConfirm(false);
          onChange([]);
        }}
        onDismiss={() => setShowConfirm(false)}
      />
    </>
  );
};
