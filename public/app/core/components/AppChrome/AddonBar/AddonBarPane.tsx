import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { AddonBarPane as AddonBarPaneType } from '../AppChromeService';
import { TOP_BAR_LEVEL_HEIGHT } from '../types';

import { ADDON_BAR_WIDTH } from './AddonBar';

export interface Props {
  pane?: AddonBarPaneType;
}

export const ADDON_BAR_PANE_WIDTH = 280;

export function AddonBarPane({ pane }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.pane}>
      <div className={styles.header}>{pane?.title}</div>
      <div className={styles.content}>{pane?.content}</div>
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
      padding: theme.spacing(1),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.h5.fontSize,
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
    }),
  };
}
