import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaMegaMenuPeekAndDock, useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Box, IconButton, Stack, ToolbarButton, useStyles2, Text } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useHomeNav } from 'app/core/hooks/useHomeNav';

import { HomeLogo, HomeTitle } from '../../Branding/Branding';
import { OrganizationSwitcher } from '../OrganizationSwitcher/OrganizationSwitcher';
import { getChromeHeaderLevelHeight } from '../TopBar/useChromeHeaderHeight';

import { MegaMenuToggleIcon } from './MegaMenuToggleIcon';

export interface Props {
  handleDockedMenu: () => void;
  onClose: () => void;
}

export const DOCK_MENU_BUTTON_ID = 'dock-menu-button';
export const MEGA_MENU_HEADER_TOGGLE_ID = 'mega-menu-header-toggle';
export const DOCKED_MENU_TOGGLE_ID = 'docked-mega-menu-toggle';

export function MegaMenuHeader({ handleDockedMenu, onClose }: Props) {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const peekAndDock = useFlagGrafanaMegaMenuPeekAndDock();
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const homeNav = useHomeNav();
  const styles = useStyles2(getStyles, visualRefreshEnabled);

  // When undocked we do not show a header, but just the org switcher (which only renders when there are multiple orgs)
  if (!state.megaMenuDocked) {
    return <OrganizationSwitcher undocked={true} />;
  }

  return (
    <div className={styles.header}>
      <Stack alignItems="center" minWidth={0} gap={1}>
        {peekAndDock ? (
          // The toggle and logo sit where they are in the top bar, so the toggle that docked the menu closes it.
          <Stack alignItems="center" gap={0.5}>
            <ToolbarButton
              narrow
              id={DOCKED_MENU_TOGGLE_ID}
              onClick={(event) => {
                // A click, not a key press: the pointer rests where the top bar toggle reappears.
                if (event.detail > 0) {
                  chrome.holdOffMegaMenuPeek();
                }
                handleDockedMenu();
              }}
              tooltip={t('navigation.megamenu.close', 'Close menu')}
            >
              <MegaMenuToggleIcon />
            </ToolbarButton>
            <HomeLogo homeNav={homeNav} />
          </Stack>
        ) : (
          state.megaMenuDocked && <HomeLogo homeNav={homeNav} onClick={state.megaMenuDocked ? undefined : onClose} />
        )}
        <OrganizationSwitcher>
          {state.megaMenuDocked && <HomeTitle homeNav={homeNav} onClick={state.megaMenuDocked ? undefined : onClose} />}
          {!state.megaMenuDocked && (
            <Box paddingLeft={2}>
              <Text color="secondary">
                <Trans i18nKey="navigation.megamenu.header-title">Navigation</Trans>
              </Text>
            </Box>
          )}
        </OrganizationSwitcher>
      </Stack>
      <div className={styles.flexGrow} />
      {!peekAndDock && (
        <IconButton
          aria-label={t('navigation.megamenu.close', 'Close menu')}
          tooltip={t('navigation.megamenu.close', 'Close menu')}
          name="times"
          onClick={onClose}
          size="lg"
          variant="secondary"
        />
      )}
    </div>
  );
}

MegaMenuHeader.displayName = 'MegaMenuHeader';

const getStyles = (theme: GrafanaTheme2, visualRefreshEnabled: boolean) => ({
  dockMenuButton: css({
    display: 'none',

    [theme.breakpoints.up('xl')]: {
      display: 'inline-flex',
    },
  }),
  header: css({
    alignItems: 'center',
    borderBottom: visualRefreshEnabled ? undefined : `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    padding: theme.spacing(0, 1, 0, 1),
    height: getChromeHeaderLevelHeight(),
    flexShrink: 0,
  }),
  flexGrow: css({ flexGrow: 1 }),
});
