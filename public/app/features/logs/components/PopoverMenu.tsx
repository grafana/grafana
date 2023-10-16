import React, { ReactElement, useCallback, useEffect, useState, MouseEvent } from 'react';

import { parseKeyValue } from '@grafana/data/src/utils/url';
import { Menu } from '@grafana/ui';

interface PopoverMenuProps {
  selection: string;
  x: number;
  y: number;
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
}

export const PopoverMenu = ({
  x,
  y,
  isFilterLabelActive,
  onClickFilterLabel,
  onClickFilterOutLabel,
  selection,
}: PopoverMenuProps) => {
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [keyValueSelection, setKeyValueSelection] = useState(parseKeyValue(selection));
  useEffect(() => {
    if (!onClickFilterLabel || !keyValueSelection.key || !keyValueSelection.value) {
      return;
    }
    isFilterLabelActive?.(keyValueSelection.key, keyValueSelection.value).then(setIsFilterActive);
  }, [isFilterLabelActive, onClickFilterLabel, keyValueSelection.key, keyValueSelection.value]);
  useEffect(() => {
    setKeyValueSelection(parseKeyValue(selection));
  }, [selection]);

  if (!onClickFilterLabel || !onClickFilterOutLabel) {
    return null;
  }

  const parsedKeyValue =
    keyValueSelection.key && keyValueSelection.value ? `${keyValueSelection.key}=${keyValueSelection.value}` : '';

  return (
    <div style={{ position: 'fixed', top: y, left: x, zIndex: 9999 }}>
      <Menu>
        <Menu.Item label="Copy" onClick={() => {}} />
        {parsedKeyValue && (
          <>
            <Menu.Item
              label={isFilterActive ? 'Remove from query' : `Filter for ${parsedKeyValue}`}
              onClick={() => onClickFilterLabel(keyValueSelection.key, keyValueSelection.value)}
            />
            <Menu.Item
              label={`Filter out ${parsedKeyValue}`}
              onClick={() => onClickFilterOutLabel(keyValueSelection.key, keyValueSelection.value)}
            />
          </>
        )}
        <Menu.Item label="Add as line filter" onClick={() => {}} />
      </Menu>
    </div>
  );
};
