import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';

import { GrafanaTheme2, LogRowModel } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Menu, useStyles2 } from '@grafana/ui';

import { copyText } from '../../logs/utils';

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
            track('copy', selection.length, row.datasourceType);
          }}
        />
        {onClickFilterValue && (
          <Menu.Item
            label="Add as line contains filter"
            onClick={() => {
              onClickFilterValue(selection, row.dataFrame.refId);
              close();
              track('line_contains', selection.length, row.datasourceType);
            }}
          />
        )}
        {onClickFilterOutValue && (
          <Menu.Item
            label="Add as line does not contain filter"
            onClick={() => {
              onClickFilterOutValue(selection, row.dataFrame.refId);
              close();
              track('line_does_not_contain', selection.length, row.datasourceType);
            }}
          />
        )}
      </Menu>
    </div>
  );
};

function track(action: string, selectionLength: number, dataSourceType: string | undefined) {
  reportInteraction(`grafana_explore_logs_popover_menu`, {
    action,
    selectionLength: selectionLength,
    datasourceType: dataSourceType || 'unknown',
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  menu: css({
    position: 'fixed',
    zIndex: theme.zIndex.modal,
  }),
});
