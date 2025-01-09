import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { TOP_BAR_LEVEL_HEIGHT } from '../types';

import { ADDON_BAR_WIDTH } from './AddonBar';

export interface Props {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  isApp?: boolean;
}

export const ADDON_BAR_PANE_WIDTH = 300;

export function AddonBarPane({ title, actions, children, isApp }: Props) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const { addonBarDocked } = chrome.useState();

  return (
    <div className={cx(styles.pane, addonBarDocked && styles.paneDocked, isApp && styles.paneApp)}>
      <div className={styles.header}>
        <div>{title}</div>

        <div className={styles.headerActions}>{actions}</div>
        <div className={styles.dockButtonWrapper}>
          <IconButton
            tooltip="Dock / undock pane"
            className={cx(styles.dockButton, addonBarDocked && styles.dockButtonDocked)}
            name="web-section-alt"
            onClick={chrome.onToggleDockAddonPane}
            variant="secondary"
          />
        </div>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    pane: css({
      display: 'flex',
      flexDirection: 'column',
      width: `${ADDON_BAR_PANE_WIDTH}px`,
      background: theme.colors.background.primary,
      position: 'fixed',
      top: `${TOP_BAR_LEVEL_HEIGHT * 2}px`,
      bottom: 0,
      right: ADDON_BAR_WIDTH + 1,
      zIndex: theme.zIndex.sidemenu,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
    paneApp: css({
      width: '90%',
    }),
    paneDocked: css({}),
    header: css({
      padding: theme.spacing(1.5, 1.5, 1, 1.5),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.h6.fontSize,
      display: 'flex',
    }),
    headerActions: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      flexGrow: 1,
      justifyContent: 'flex-end',
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'auto',
      padding: theme.spacing(1, 0),
    }),
    dockButtonWrapper: css({
      padding: theme.spacing(0, 1),
      display: 'flex',
    }),
    dockButton: css({
      color: theme.colors.text.disabled,
    }),
    dockButtonDocked: css({
      color: theme.colors.text.secondary,
    }),
  };
}
