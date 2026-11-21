import { css } from '@emotion/css';
import { useCallback, useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Menu, useStyles2 } from '@grafana/ui';

import { copyText } from '../../logs/utils';

interface PopoverMenuProps {
  selection: string;
  x: number;
  y: number;
  onClickFilterString?: (value: string, refId?: string) => void;
  onClickFilterOutString?: (value: string, refId?: string) => void;
  onClickSearchString?: (text: string) => void;
  onDisable: () => void;
  refId?: string;
  datasourceType?: string;
  close: () => void;
}

export const PopoverMenu = ({
  x,
  y,
  onClickFilterString,
  onClickFilterOutString,
  onClickSearchString,
  selection,
  refId,
  datasourceType,
  close,
  ...props
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

  const onDisable = useCallback(() => {
    track('popover_menu_disabled', selection.length, datasourceType);
    props.onDisable();
  }, [props, datasourceType, selection.length]);

  const supported = onClickFilterString || onClickFilterOutString || onClickSearchString;

  if (!supported) {
    return null;
  }

  return (
    <>
      <div className={styles.menu} style={{ top: y, left: x }}>
        <Menu ref={containerRef}>
          <Menu.Item
            label={t('logs.popover-menu.copy', 'Copy selection')}
            onClick={() => {
              copyText(selection, containerRef);
              close();
              track('copy', selection.length, datasourceType);
            }}
          />
          {onClickFilterString && (
            <Menu.Item
              label={t('logs.popover-menu.line-contains', 'Add as line contains filter')}
              onClick={() => {
                onClickFilterString(selection, refId);
                close();
                track('line_contains', selection.length, datasourceType);
              }}
            />
          )}
          {onClickFilterOutString && (
            <Menu.Item
              label={t('logs.popover-menu.line-contains-not', 'Add as line does not contain filter')}
              onClick={() => {
                onClickFilterOutString(selection, refId);
                close();
                track('line_does_not_contain', selection.length, datasourceType);
              }}
            />
          )}
          <Menu.Divider />
          {onClickSearchString && (
            <Menu.Item
              label={t('logs.popover-menu.search-text', 'Search in results')}
              onClick={() => {
                onClickSearchString(selection);
                close();
                track('search_text', selection.length, datasourceType);
              }}
            />
          )}
          <Menu.Divider />
          <Menu.Item label={t('logs.popover-menu.disable-menu', 'Disable menu')} onClick={onDisable} />
        </Menu>
      </div>
    </>
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
