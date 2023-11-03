import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';

import { GrafanaTheme2, LogRowModel } from '@grafana/data';
import { Menu, useStyles2 } from '@grafana/ui';

import { copyText } from '../utils';

interface PopoverMenuProps {
  selection: string;
  x: number;
  y: number;
  onClickFilterValue?: (value: string, refId?: string) => void;
  onClickFilterOutValue?: (value: string, refId?: string) => void;
  row: LogRowModel;
  close: () => void;
}

export const PopoverMenu = ({
  x,
  y,
  onClickFilterValue,
  onClickFilterOutValue,
  selection,
  row,
  close,
}: PopoverMenuProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
      }
    }
    document.addEventListener('keyup', handleEscape);

    return () => {
      document.removeEventListener('keyup', handleEscape);
    };
  }, [close]);

  const supported = onClickFilterValue || onClickFilterOutValue;

  if (!supported) {
    return null;
  }

  return (
    <div className={styles.menu} style={{ top: y, left: x }}>
      <Menu ref={containerRef}>
        <Menu.Item
          label="Copy selection"
          onClick={() => {
            copyText(selection, containerRef);
            close();
          }}
        />
        {onClickFilterValue && (
          <Menu.Item
            label="Add as line contains filter"
            onClick={() => {
              onClickFilterValue(selection, row.dataFrame.refId);
              close();
            }}
          />
        )}
        {onClickFilterOutValue && (
          <Menu.Item
            label="Add as line does not contain filter"
            onClick={() => {
              onClickFilterOutValue(selection, row.dataFrame.refId);
              close();
            }}
          />
        )}
      </Menu>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  menu: css({
    position: 'fixed',
    zIndex: theme.zIndex.modal,
  }),
});
