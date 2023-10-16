import React, { useEffect, useRef, useState } from 'react';

import { LogRowModel } from '@grafana/data';
import { Menu } from '@grafana/ui';
import { parseKeyValue } from 'app/plugins/datasource/loki/queryUtils';

import { copyText } from '../utils';

interface PopoverMenuProps {
  selection: string;
  x: number;
  y: number;
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  row: LogRowModel;
}

export const PopoverMenu = ({
  x,
  y,
  isFilterLabelActive,
  onClickFilterLabel,
  onClickFilterOutLabel,
  selection,
  row,
}: PopoverMenuProps) => {
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [keyValueSelection, setKeyValueSelection] = useState(parseKeyValue(selection));
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onClickFilterLabel || !keyValueSelection.key || !keyValueSelection.value) {
      return;
    }
    isFilterLabelActive?.(keyValueSelection.key, keyValueSelection.value, row.dataFrame.refId).then(setIsFilterActive);
  }, [isFilterLabelActive, onClickFilterLabel, keyValueSelection.key, keyValueSelection.value, row.dataFrame.refId]);
  useEffect(() => {
    setKeyValueSelection(parseKeyValue(selection));
  }, [selection]);

  if (!onClickFilterLabel || !onClickFilterOutLabel) {
    return null;
  }

  const parsedKeyValue =
    keyValueSelection.key && keyValueSelection.value ? `${keyValueSelection.key}=${keyValueSelection.value}` : '';

  return (
    <div style={{ position: 'fixed', top: y, left: x, zIndex: 9999 }} ref={containerRef}>
      <Menu>
        <Menu.Item label="Copy" onClick={() => {
          copyText(selection, containerRef);
        }} />
        {parsedKeyValue && (
          <>
            <Menu.Item
              label={isFilterActive ? 'Remove from query' : `Filter for ${parsedKeyValue}`}
              onClick={() => onClickFilterLabel(keyValueSelection.key, keyValueSelection.value, row.dataFrame.refId)}
            />
            <Menu.Item
              label={`Filter out ${parsedKeyValue}`}
              onClick={() => onClickFilterOutLabel(keyValueSelection.key, keyValueSelection.value, row.dataFrame.refId)}
            />
          </>
        )}
        <Menu.Item label="Add as line filter" onClick={() => {}} />
      </Menu>
    </div>
  );
};
