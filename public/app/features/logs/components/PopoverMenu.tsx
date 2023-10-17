import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2, LogRowModel } from '@grafana/data';
import { Menu, useStyles2 } from '@grafana/ui';
import { parseKeyValue } from 'app/plugins/datasource/loki/queryUtils';

import { copyText } from '../utils';

interface PopoverMenuProps {
  selection: string;
  x: number;
  y: number;
  onClickFilterLabel?: (key: string, value: string, refId?: string) => void;
  onClickFilterOutLabel?: (key: string, value: string, refId?: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  onClickFilterValue?: (value: string, refId?: string) => void;
  onClickFilterOutValue?: (value: string, refId?: string) => void;
  row: LogRowModel;
  close: () => void;
}

export const PopoverMenu = ({
  x,
  y,
  isFilterLabelActive,
  onClickFilterLabel,
  onClickFilterOutLabel,
  onClickFilterValue,
  onClickFilterOutValue,
  selection,
  row,
  close,
}: PopoverMenuProps) => {
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [keyValueSelection, setKeyValueSelection] = useState(parseKeyValue(selection));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (!onClickFilterLabel || !keyValueSelection?.key || !keyValueSelection?.value) {
      return;
    }
    isFilterLabelActive?.(keyValueSelection.key, keyValueSelection.value, row.dataFrame.refId).then(setIsFilterActive);
  }, [isFilterLabelActive, keyValueSelection?.key, keyValueSelection?.value, onClickFilterLabel, row.dataFrame.refId]);
  useEffect(() => {
    setKeyValueSelection(parseKeyValue(selection));
  }, [selection]);

  const supported = onClickFilterLabel || onClickFilterOutLabel;

  if (!supported) {
    return null;
  }

  return (
    <div className={styles.menu} style={{ position: 'fixed', top: y, left: x }}>
      <Menu ref={containerRef}>
        <Menu.Item
          label="Copy selection"
          onClick={() => {
            copyText(selection, containerRef);
            close();
          }}
        />
        {keyValueSelection && onClickFilterLabel && (
          <Menu.Item
            label={isFilterActive ? 'Remove from query' : `Filter for ${keyValueSelection.key} = ${keyValueSelection.value}`}
            onClick={() => {
              onClickFilterLabel(keyValueSelection.key, keyValueSelection.value, row.dataFrame.refId)
              close();
            }}
          />
        )}
        {keyValueSelection && onClickFilterOutLabel && (
          <Menu.Item
            label={`Filter out ${keyValueSelection.key} != ${keyValueSelection.value}`}
            onClick={() => {
              onClickFilterOutLabel(keyValueSelection.key, keyValueSelection.value, row.dataFrame.refId)
              close();
            }}
          />
        )}
        <Menu.Item label="Add as line contains filter" onClick={() => {
          onClickFilterValue?.(selection, row.dataFrame.refId);
          close();
        }} />
        <Menu.Item label="Add as line does not contain filter" onClick={() => {
          onClickFilterOutValue?.(selection, row.dataFrame.refId);
          close();
        }} />
      </Menu>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  menu: css({
    position: 'fixed',
    zIndex: theme.zIndex.modal,
  })
});
