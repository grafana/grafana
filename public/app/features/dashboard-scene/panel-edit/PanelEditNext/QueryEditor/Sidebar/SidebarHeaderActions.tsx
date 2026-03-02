import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

import { getQueryEditorColors, SidebarSize } from '../../constants';

interface SidebarHeaderActionsProps {
  sidebarSize: SidebarSize;
  setSidebarSize: (size: SidebarSize) => void;
  children?: ReactNode;
}

export function SidebarHeaderActions({ sidebarSize, setSidebarSize, children }: SidebarHeaderActionsProps) {
  const styles = useStyles2(getStyles);
  const isMini = sidebarSize === SidebarSize.Mini;

  return (
    <div className={styles.header}>
      <div className={styles.inner}>
        <IconButton
          name={isMini ? 'maximize-left' : 'compress-alt-left'}
          size="sm"
          variant="secondary"
          onClick={() => setSidebarSize(isMini ? SidebarSize.Full : SidebarSize.Mini)}
          aria-label={t('query-editor-next.sidebar.toggle-size', 'Toggle sidebar size')}
        />
        {children}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const themeColors = getQueryEditorColors(theme);
  return {
    header: css({
      background: themeColors.sidebarHeaderBackground,
      padding: theme.spacing(0.5, 1.5),
      minHeight: theme.spacing(5),
      display: 'flex',
      alignItems: 'center',
    }),
    inner: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
  };
}
