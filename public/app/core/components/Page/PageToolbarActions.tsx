import { css } from '@emotion/css';
import { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';
import { useChromeHeaderHeight } from '@grafana/runtime';
import { Stack, useStyles2 } from '@grafana/ui';

import { TOP_BAR_LEVEL_HEIGHT } from '../AppChrome/types';

export const TOGGLE_BUTTON_ID = 'mega-menu-toggle';

export interface Props {}

export function PageToolbarActions({ children }: PropsWithChildren<Props>) {
  const chromeHeaderHeight = useChromeHeaderHeight();
  const styles = useStyles2(getStyles, chromeHeaderHeight ?? 0);

  return (
    <div data-testid={Components.NavToolbar.container} className={styles.pageToolbar}>
      <Stack alignItems="center" justifyContent="flex-end" flex={1} wrap="nowrap" minWidth={0}>
        {children}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, chromeHeaderHeight: number) => {
  return {
    pageToolbar: css({
      alignItems: 'center',
      backgroundColor: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      height: TOP_BAR_LEVEL_HEIGHT,
      padding: theme.spacing(0, 1, 0, 2),
      position: 'sticky',
      top: chromeHeaderHeight,
      zIndex: theme.zIndex.navbarFixed,
    }),
  };
};
