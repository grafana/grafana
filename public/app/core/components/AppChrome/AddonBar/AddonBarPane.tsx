import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { TOP_BAR_LEVEL_HEIGHT } from '../types';

import { ADDON_BAR_WIDTH } from './AddonBar';

export interface Props {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const ADDON_BAR_PANE_WIDTH = 280;

export function AddonBarPane({ title, actions, children }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.pane}>
      <div className={styles.header}>
        <div>{title}</div>
        <div className={styles.headerActions}>{actions}</div>
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
      zIndex: 1,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
    header: css({
      padding: theme.spacing(1, 1.5),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.h5.fontSize,
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
  };
}
