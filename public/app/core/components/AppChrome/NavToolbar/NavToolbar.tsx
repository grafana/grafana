import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { Icon, ToolbarButton, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { t } from 'app/core/internationalization';
import { KioskMode } from 'app/types';

import { TOP_BAR_LEVEL_HEIGHT } from '../types';

export const TOGGLE_BUTTON_ID = 'mega-menu-toggle';

export interface Props {
  children: React.ReactNode;
}

export function NavToolbar({ children }: Props) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const searchBarHidden = state.searchBarHidden || state.kioskMode === KioskMode.TV;

  return (
    <div data-testid={Components.NavToolbar.container} className={styles.pageToolbar}>
      <div className={styles.actions}>
        {children}
        {/* {searchBarHidden && (
          <ToolbarButton
            onClick={() => {}}
            narrow
            title={t('navigation.toolbar.enable-kiosk', 'Enable kiosk mode')}
            icon="monitor"
          />
        )}
        <ToolbarButton
          onClick={() => {}}
          narrow
          title={t('navigation.toolbar.toggle-search-bar', 'Toggle top search bar')}
        >
          <Icon name={searchBarHidden ? 'angle-down' : 'angle-up'} size="xl" />
        </ToolbarButton> */}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    breadcrumbsWrapper: css({
      display: 'flex',
      overflow: 'hidden',
      [theme.breakpoints.down('sm')]: {
        minWidth: '50%',
      },
    }),
    pageToolbar: css({
      height: TOP_BAR_LEVEL_HEIGHT,
      display: 'flex',
      padding: theme.spacing(0, 1, 0, 2),
      alignItems: 'center',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
    menuButton: css({
      display: 'flex',
      alignItems: 'center',
      marginRight: theme.spacing(1),
    }),
    actions: css({
      label: 'NavToolbar-actions',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'nowrap',
      justifyContent: 'flex-end',
      paddingLeft: theme.spacing(1),
      flexGrow: 1,
      gap: theme.spacing(1),
      minWidth: 0,

      '.body-drawer-open &': {
        display: 'none',
      },
    }),
  };
};
