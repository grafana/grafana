import { css } from '@emotion/css';
import { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { Stack, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { MENU_WIDTH } from '../AppChrome/MegaMenu/MegaMenu';
import { TOP_BAR_LEVEL_HEIGHT } from '../AppChrome/types';

export interface Props {}

export function PageToolbarActions({ children }: PropsWithChildren<Props>) {
  const chromeHeaderHeight = useChromeHeaderHeight();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const menuDockedAndOpen = !state.chromeless && state.megaMenuDocked && state.megaMenuOpen;
  const styles = useStyles2(getStyles, chromeHeaderHeight ?? 0, menuDockedAndOpen);

  return (
    <div data-testid={Components.NavToolbar.container} className={styles.pageToolbar}>
      <Stack alignItems="center" justifyContent="flex-end" flex={1} wrap="nowrap" minWidth={0}>
        {children}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, chromeHeaderHeight: number, menuDockedAndOpen: boolean) => {
  return {
    pageToolbar: css({
      alignItems: 'center',
      backgroundColor: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      height: TOP_BAR_LEVEL_HEIGHT,
      left: menuDockedAndOpen ? MENU_WIDTH : 0,
      padding: theme.spacing(0, 1, 0, 2),
      position: 'fixed',
      top: chromeHeaderHeight,
      right: 0,
      zIndex: theme.zIndex.navbarFixed,
    }),
  };
};
